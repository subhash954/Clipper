import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CostLedgerEntry, MarginReport } from './types';
import { getTenantStore } from './tenantStore';
import { getEntitlementService } from './entitlementService';

export class CostLedger {
  private baseDir = path.join(process.cwd(), 'data', 'saas');
  private costFile = path.join(process.cwd(), 'data', 'saas', 'cost_ledger.json');

  constructor() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private read<T>(filePath: string): T[] {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch {
      // Ignore
    }
    return [];
  }

  private write<T>(filePath: string, data: T[]): void {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async recordCost(entry: Omit<CostLedgerEntry, 'id' | 'timestamp'>): Promise<CostLedgerEntry> {
    const costs = this.read<CostLedgerEntry>(this.costFile);
    const record: CostLedgerEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    costs.push(record);
    this.write(this.costFile, costs);
    return record;
  }

  async getMarginReport(organizationId: string, sinceDate?: Date): Promise<MarginReport> {
    const tenantStore = getTenantStore();
    const org = await tenantStore.getOrganization(organizationId);
    const entitlementService = getEntitlementService();
    const plan = entitlementService.getPlan(org?.planId || 'starter');

    const totalRevenueUSD = plan.monthlyPriceUSD;

    const costs = this.read<CostLedgerEntry>(this.costFile);
    const since = sinceDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const orgCosts = costs.filter(c => {
      if (c.organizationId !== organizationId) return false;
      return new Date(c.timestamp).getTime() >= since.getTime();
    });

    let aiCostUSD = 0;
    let transcriptionCostUSD = 0;
    let renderingCostUSD = 0;
    let storageCostUSD = 0;

    for (const c of orgCosts) {
      if (c.serviceCategory === 'ai') aiCostUSD += c.actualCostUSD;
      else if (c.serviceCategory === 'transcription') transcriptionCostUSD += c.actualCostUSD;
      else if (c.serviceCategory === 'rendering') renderingCostUSD += c.actualCostUSD;
      else if (c.serviceCategory === 'storage') storageCostUSD += c.actualCostUSD;
    }

    const totalCostUSD = aiCostUSD + transcriptionCostUSD + renderingCostUSD + storageCostUSD;
    const grossProfitUSD = Math.max(0, totalRevenueUSD - totalCostUSD);
    const grossMarginPercent = totalRevenueUSD > 0
      ? Number(((grossProfitUSD / totalRevenueUSD) * 100).toFixed(1))
      : 0;

    return {
      organizationId,
      period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
      totalRevenueUSD,
      totalCostUSD: Number(totalCostUSD.toFixed(2)),
      breakdown: {
        aiCostUSD: Number(aiCostUSD.toFixed(2)),
        transcriptionCostUSD: Number(transcriptionCostUSD.toFixed(2)),
        renderingCostUSD: Number(renderingCostUSD.toFixed(2)),
        storageCostUSD: Number(storageCostUSD.toFixed(2)),
      },
      grossProfitUSD: Number(grossProfitUSD.toFixed(2)),
      grossMarginPercent,
    };
  }
}

// Singleton
let costLedgerInstance: CostLedger | null = null;

export function getCostLedger(): CostLedger {
  if (!costLedgerInstance) {
    costLedgerInstance = new CostLedger();
  }
  return costLedgerInstance;
}
