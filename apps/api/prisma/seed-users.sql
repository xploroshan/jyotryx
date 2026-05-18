-- Seed admin and demo users (idempotent - skips if already exist)
INSERT INTO users (id, email, name, "passwordHash", role, credits, provider, "preferredLanguage", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'admin@myastro360.com', 'myastro360 Admin', '$2b$10$22nXhNa7hffCDMRxxIW23OJBlpf650dhgHAVb7jveTDh4ftKgYgSa', 'ADMIN', 9999, 'LOCAL', 'en', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (id, email, name, "passwordHash", role, credits, provider, "preferredLanguage", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'demo@myastro360.com', 'Demo User', '$2b$10$DIahpy0q9y3ii7BQw4D31uCpv9h3DYc7VDE0pm9PH49vKeIgFG0rq', 'USER', 10, 'LOCAL', 'en', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;
