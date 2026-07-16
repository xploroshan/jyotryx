import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAIService } from '../openai/openai.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { UserService } from '../modules/user/user.service';
import { FeatureAccessService } from '../common/feature-access/feature-access.service';
import { StorageService } from '../storage/storage.service';
import { PALMISTRY_QUEUE } from './queue.constants';
import { PalmAnalysisFailedError, runPalmVisionPipeline } from '../modules/palmistry/palm-analysis.pipeline';
import type { HandLandmarkInput } from '../modules/palmistry/palm-metrics.util';
import type { PalmVerification } from '../modules/palmistry/palm-verification.util';

export interface PalmistryJobData {
  readingId: string;
  userId: string;
  creditCost: number;
  imageKey?: string;
  imageMimeType?: string;
  locale?: string;
  gender?: string;
  /** Client-measured hand landmarks (already validated by the service). */
  landmarks?: HandLandmarkInput;
  /** Subscription-model meter to give back if the job fails after counting. */
  meteredFeature?: string;
  meteredPeriodKey?: string;
}

@Processor(PALMISTRY_QUEUE)
export class PalmistryProcessor extends WorkerHost {
  private readonly logger = new Logger(PalmistryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openaiService: OpenAIService,
    private readonly knowledgeService: KnowledgeService,
    private readonly userService: UserService,
    private readonly featureAccess: FeatureAccessService,
    private readonly storageService: StorageService,
  ) {
    super();
  }

  async process(job: Job<PalmistryJobData>): Promise<void> {
    const { readingId, userId, creditCost, imageKey, locale, gender, landmarks, meteredFeature, meteredPeriodKey } = job.data;
    this.logger.log(`Processing palmistry job ${job.id} — readingId=${readingId}`);

    try {
      const client = this.openaiService.getClient();
      if (!client || !imageKey || !this.storageService.isAvailable()) {
        // HONESTY CONTRACT: a queued job always has a paid, image-backed
        // reading behind it. With no vision client or no stored image there is
        // nothing real to analyse — fail (and refund on the final attempt)
        // instead of serving the canned same-for-everyone fallback.
        throw new Error(
          `Palmistry job cannot run: ${!client ? 'no vision client' : !imageKey ? 'no stored image' : 'storage unavailable'}`,
        );
      }

      // Fetch palmistry KB context (best-effort).
      let palmKBSection = '';
      try {
        const palmKB = await this.knowledgeService.getByCategory('palmistry', 15);
        const palmKBContext = this.knowledgeService.assembleContext(palmKB);
        palmKBSection = palmKBContext ? `\n\nReference Knowledge:\n${palmKBContext}` : '';
      } catch (err) {
        this.logger.warn(`Palmistry KB lookup failed, continuing without it: ${(err as Error)?.message}`);
      }

      // Verification seed (hashes/id computed at enqueue time, when the raw
      // bytes were available) rides in the processing stub.
      const row = await this.prisma.palmistryReading.findUnique({
        where: { id: readingId },
        select: { analysisData: true },
      });
      const seed = (row?.analysisData as any)?.verificationSeed ?? {};

      const visionModel = this.openaiService.getModelForFeature('palmistry-vision');
      const presignedUrl = await this.storageService.getPresignedDownloadUrl(imageKey);

      const result = await runPalmVisionPipeline({
        client,
        readingModel: visionModel,
        geometryModel: visionModel,
        imageUrl: presignedUrl,
        kbSection: palmKBSection,
        locale,
        gender,
        landmarks: landmarks ?? null,
        recordUsage: (model, usage) =>
          this.openaiService.recordUsage?.({ userId, feature: 'palmistry', model, usage }),
        logger: this.logger,
      });

      const verification: PalmVerification = {
        verificationId: seed.verificationId ?? '',
        imageSha256: seed.imageSha256 ?? null,
        landmarkFingerprint: seed.landmarkFingerprint ?? null,
        groundednessScore: result.grounding.groundednessScore,
        checks: result.grounding.checks,
        authentic: true,
        duplicateOf: seed.duplicateOf ?? undefined,
      };

      await this.prisma.palmistryReading.update({
        where: { id: readingId },
        data: {
          analysisData: {
            ...result.analysisData,
            geometry: result.geometry as any,
            factors: result.factors as any,
            verification: verification as any,
          },
        },
      });

      this.logger.log(`Palmistry reading ${readingId} completed successfully`);
    } catch (error) {
      this.logger.error(`Palmistry ${readingId} failed: ${(error as Error).message}`);

      // A reasoned image rejection (back of hand / not a hand) is a VERDICT,
      // not a transient failure — retrying the job would re-run the vision
      // call on the same image for the same answer. Treat it as final
      // immediately: refund, mark failed with the specific code, stop retries.
      const rejection =
        error instanceof PalmAnalysisFailedError && error.reason ? error.reason : null;

      // Refund on final attempt. Palmistry is pay-to-unlock, so restore the
      // one-time entitlement bound to this reading (no-op for subscriber/
      // free readings). Legacy credit-charged jobs still get credits back.
      // Every step is individually guarded: a DB blip in one refund must not
      // skip the remaining refunds or the failed-marker (which the client's
      // polling depends on to stop).
      if (rejection !== null || job.attemptsMade >= (job.opts?.attempts ?? 3) - 1) {
        await this.featureAccess
          .refundEntitlementByRef(readingId)
          .catch((e) => this.logger.error(`Entitlement refund failed for ${readingId}`, e as Error));
        // Subscription model: give back the metered reading counted at enqueue.
        if (meteredFeature && meteredPeriodKey) {
          await this.featureAccess
            .decrementUsage(userId, meteredFeature, meteredPeriodKey)
            .catch((e) => this.logger.error(`Metered refund failed for ${readingId}`, e as Error));
        }
        if (creditCost > 0) {
          this.logger.log(`Refunding ${creditCost} credits for failed palmistry ${readingId}`);
          await this.userService
            .addCredits(userId, creditCost, 'PURCHASE', 'Refund: Palmistry analysis failed')
            .catch((e) => this.logger.error(`Credit refund failed for ${readingId}`, e as Error));
        }
        // Mark the reading as failed so the client polling stops with a clear
        // status. Preserve the verification seed so a manual operator retry
        // can still stitch the original hashes/id.
        try {
          const row = await this.prisma.palmistryReading.findUnique({
            where: { id: readingId },
            select: { analysisData: true },
          });
          const seed = (row?.analysisData as any)?.verificationSeed;
          await this.prisma.palmistryReading.update({
            where: { id: readingId },
            data: {
              analysisData: {
                status: 'failed',
                message:
                  rejection === 'back_of_hand'
                    ? 'That looks like the back of your hand — turn your palm toward the camera and try again. Your purchase has been restored.'
                    : rejection === 'not_a_hand'
                      ? "We couldn't find a hand in this photo. Your purchase has been restored."
                      : 'Analysis failed. Your purchase has been restored.',
                ...(rejection ? { failCode: rejection } : {}),
                ...(seed ? { verificationSeed: seed } : {}),
              },
            },
          });
        } catch (updateErr) {
          this.logger.error('Failed to mark reading as failed', updateErr as Error);
        }
      }

      // UnrecoverableError tells BullMQ to fail the job without further
      // attempts — the verdict won't change on a re-run.
      if (rejection) throw new UnrecoverableError((error as Error).message);
      throw error;
    }
  }
}
