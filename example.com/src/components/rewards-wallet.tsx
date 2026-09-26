"use client";

import { useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { useApiAction } from "@/components/use-api-action";
import { convertRewardBlocks } from "@/lib/commerce-actions";

type RewardsSummary = {
  pointMilliBalance: number;
  pointMilliLifetimeEarned: number;
  pointMilliLifetimeSpent: number;
  walletAvailableFils: number;
  walletHeldFils: number;
  walletPendingFils: number;
  walletLifetimeEarnedFils: number;
  walletLifetimeSpentFils: number;
  walletLifetimePaidOutFils: number;
  conversionWeekStart: string;
  weeklyBlocksRemaining: number;
  expires: false;
  history: {
    ledger: string;
    kind: string;
    direction: string;
    amount: string;
    source_type: string;
    source_id: string;
    created_at: string;
  }[];
};

const points = (milliPoints: number) => (milliPoints / 1_000).toFixed(3);
const jod = (fils: number) => (fils / 1_000).toFixed(3);

export function RewardsWallet({ summary }: { summary: RewardsSummary }) {
  const [blocks, setBlocks] = useState(1);
  const { text } = useLanguage();
  const { pending, perform, message, live } = useApiAction();
  const operationKey = useRef<string | null>(null);

  async function convert() {
    void perform(async () => {
      operationKey.current ??= crypto.randomUUID();
      await convertRewardBlocks(blocks, operationKey.current);
      location.reload();
    });
  }

  return (
    <>
      <section className="panel">
        <p className="eyebrow">{text("Wallet", "المحفظة")}</p>
        <h2>
          {jod(summary.walletAvailableFils)} {text("JOD available", "د.أ متاح")}
        </h2>
        <p>
          {text(
            `Held ${jod(summary.walletHeldFils)} JOD · pending ${jod(summary.walletPendingFils)} JOD`,
            `محجوز ${jod(summary.walletHeldFils)} د.أ · معلّق ${jod(summary.walletPendingFils)} د.أ`,
          )}
        </p>
        <p>
          {text(
            `Lifetime earned ${jod(summary.walletLifetimeEarnedFils)} · spent ${jod(summary.walletLifetimeSpentFils)} · paid out ${jod(summary.walletLifetimePaidOutFils)} JOD`,
            `إجمالي المكتسب ${jod(summary.walletLifetimeEarnedFils)} · المنفق ${jod(summary.walletLifetimeSpentFils)} · المسحوب ${jod(summary.walletLifetimePaidOutFils)} د.أ`,
          )}
        </p>
        <strong>
          {text(
            "Wallet funds and points never expire.",
            "أموال المحفظة والنقاط لا تنتهي صلاحيتها.",
          )}
        </strong>
      </section>
      <section className="panel" aria-busy={pending}>
        <p className="eyebrow">{text("Points", "النقاط")}</p>
        <h2>
          {points(summary.pointMilliBalance)} {text("points", "نقطة")}
        </h2>
        <p>
          {text(
            `Lifetime earned ${points(summary.pointMilliLifetimeEarned)} · spent ${points(summary.pointMilliLifetimeSpent)}`,
            `إجمالي المكتسب ${points(summary.pointMilliLifetimeEarned)} · المنفق ${points(summary.pointMilliLifetimeSpent)}`,
          )}
        </p>
        <p>
          {text(
            `100 points convert to 1 JOD. ${summary.weeklyBlocksRemaining} of 5 blocks remain for the week beginning ${summary.conversionWeekStart}.`,
            `تُحوّل كل 100 نقطة إلى 1 د.أ. المتبقي ${summary.weeklyBlocksRemaining} من 5 وحدات للأسبوع الذي يبدأ في ${summary.conversionWeekStart}.`,
          )}
        </p>
        <label>
          {text("Blocks to convert", "وحدات التحويل")}
          <input
            type="number"
            min="1"
            max={Math.max(1, Math.min(5, summary.weeklyBlocksRemaining))}
            step="1"
            value={blocks}
            disabled={pending || summary.weeklyBlocksRemaining < 1}
            onChange={(event) => {
              setBlocks(Number(event.target.value));
              operationKey.current = null;
            }}
          />
        </label>
        <button
          className="primary"
          type="button"
          onClick={convert}
          disabled={
            pending ||
            !Number.isInteger(blocks) ||
            blocks < 1 ||
            blocks > Math.min(5, summary.weeklyBlocksRemaining)
          }
        >
          {text(
            pending ? "Converting…" : "Convert points",
            pending ? "جارٍ التحويل…" : "تحويل النقاط",
          )}
        </button>
        <p aria-live={live}>{message}</p>
      </section>
      <section className="panel">
        <h2>{text("Recent reward activity", "سجل المكافآت الأخير")}</h2>
        <div className="list">
          {summary.history.length ? (
            summary.history.map((entry, index) => (
              <article key={`${entry.ledger}-${entry.source_id}-${index}`}>
                <strong>
                  {entry.ledger} · {entry.kind} · {entry.direction}
                </strong>
                <p>
                  {entry.ledger === "POINTS"
                    ? `${points(Number(entry.amount))} points`
                    : `${jod(Number(entry.amount))} JOD`}{" "}
                  · {entry.source_type}
                </p>
                <small>
                  {entry.source_id} · {new Date(entry.created_at).toISOString()}
                </small>
              </article>
            ))
          ) : (
            <p>{text("No reward activity yet.", "لا يوجد نشاط مكافآت بعد.")}</p>
          )}
        </div>
      </section>
    </>
  );
}
