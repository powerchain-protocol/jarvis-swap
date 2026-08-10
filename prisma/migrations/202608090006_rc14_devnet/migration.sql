-- rc.14: support Sui Devnet in non-production development/test deployments.
ALTER TYPE "Network" ADD VALUE IF NOT EXISTS 'devnet';
