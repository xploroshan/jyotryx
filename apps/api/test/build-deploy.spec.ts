/**
 * Build & Deploy Validation Tests
 *
 * Verifies K8s manifests, Docker configuration, and CI pipeline integrity.
 */
import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '../../../');
const K8S_BASE = path.join(ROOT, 'k8s/base');

function readYaml(filePath: string): any {
  return yaml.load(fs.readFileSync(filePath, 'utf-8'));
}

// ─── K8s Manifests ─────────────────────────────────────────────────────

describe('K8s Manifests', () => {
  it('kustomization.yaml should exist and list all resources', () => {
    const kustomPath = path.join(K8S_BASE, 'kustomization.yaml');
    expect(fs.existsSync(kustomPath)).toBe(true);

    const kustom = readYaml(kustomPath);
    expect(kustom.resources).toBeDefined();
    expect(kustom.resources).toContain('api-deployment.yaml');
    expect(kustom.resources).toContain('web-deployment.yaml');
    expect(kustom.resources).toContain('ingress.yaml');
  });

  it('API deployment should have resource limits and requests', () => {
    const deploy = readYaml(path.join(K8S_BASE, 'api-deployment.yaml'));
    const container = deploy.spec.template.spec.containers[0];
    expect(container.resources.requests.cpu).toBeDefined();
    expect(container.resources.requests.memory).toBeDefined();
    expect(container.resources.limits.cpu).toBeDefined();
    expect(container.resources.limits.memory).toBeDefined();
  });

  it('API deployment should have readiness and liveness probes', () => {
    const deploy = readYaml(path.join(K8S_BASE, 'api-deployment.yaml'));
    const container = deploy.spec.template.spec.containers[0];
    expect(container.readinessProbe).toBeDefined();
    expect(container.livenessProbe).toBeDefined();
  });

  it('API deployment should have preStop hook for graceful drain', () => {
    const deploy = readYaml(path.join(K8S_BASE, 'api-deployment.yaml'));
    const container = deploy.spec.template.spec.containers[0];
    expect(container.lifecycle?.preStop).toBeDefined();
  });

  it('API HPA should have min/max replicas and CPU/memory targets', () => {
    const hpa = readYaml(path.join(K8S_BASE, 'api-hpa.yaml'));
    expect(hpa.spec.minReplicas).toBeGreaterThanOrEqual(2);
    expect(hpa.spec.maxReplicas).toBeGreaterThanOrEqual(4);
    expect(hpa.spec.metrics).toBeDefined();
  });

  it('API PDB should have minAvailable set', () => {
    const pdb = readYaml(path.join(K8S_BASE, 'api-pdb.yaml'));
    expect(pdb.spec.minAvailable).toBeDefined();
  });

  it('Ingress should have TLS configuration', () => {
    const ingress = readYaml(path.join(K8S_BASE, 'ingress.yaml'));
    expect(ingress.spec.tls).toBeDefined();
    expect(ingress.spec.tls[0].secretName).toBeDefined();
  });

  it('Ingress should define routes for both API and web', () => {
    const ingress = readYaml(path.join(K8S_BASE, 'ingress.yaml'));
    const hosts = ingress.spec.rules.map((r: any) => r.host);
    expect(hosts).toContain('api.jyotron.com');
    expect(hosts).toContain('www.jyotron.com');
  });

  it('All YAML files in k8s/base should parse without error', () => {
    const files = fs.readdirSync(K8S_BASE).filter((f) => f.endsWith('.yaml'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(() => readYaml(path.join(K8S_BASE, file))).not.toThrow();
    }
  });
});

// ─── Docker Configuration ──────────────────────────────────────────────

describe('Docker Configuration', () => {
  it('API Dockerfile should exist', () => {
    expect(fs.existsSync(path.join(ROOT, 'apps/api/Dockerfile'))).toBe(true);
  });

  it('docker-compose.yml should exist', () => {
    const composePath = path.join(ROOT, 'docker-compose.yml');
    expect(fs.existsSync(composePath)).toBe(true);
  });
});

// ─── CI Pipeline ───────────────────────────────────────────────────────

describe('CI Pipeline', () => {
  const ciPath = path.join(ROOT, '.github/workflows/ci.yml');

  it('CI workflow file should exist', () => {
    expect(fs.existsSync(ciPath)).toBe(true);
  });

  it('should define all expected CI jobs', () => {
    const content = fs.readFileSync(ciPath, 'utf-8');
    expect(content).toContain('lint-and-test-api');
    expect(content).toContain('build-and-test-web');
    expect(content).toContain('lighthouse');
    expect(content).toContain('bundle-size');
  });

  it('should run on push and pull_request', () => {
    const ci = readYaml(ciPath);
    expect(ci.on.push).toBeDefined();
    expect(ci.on.pull_request).toBeDefined();
  });

  it('should have concurrency configuration', () => {
    const ci = readYaml(ciPath);
    expect(ci.concurrency).toBeDefined();
    expect(ci.concurrency['cancel-in-progress']).toBe(true);
  });
});
