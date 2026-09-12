"use client";

import { useState } from "react";

type PromotionRule = {
  publicId: string;
  nameEn: string;
  nameAr: string;
  enabled: boolean;
  priority: number;
  version: number;
};

export type Campaign = {
  public_id: string;
  internal_name: string;
  name_en: string;
  name_ar: string;
  status: string;
  budget_fils: string | null;
  used_fils: string;
  rules: PromotionRule[];
};

async function mutate(path: string, method: string, body: unknown) {
  const response = await fetch(path, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok)
    throw new Error(payload.error?.code ?? "PROMOTION_REQUEST_FAILED");
  return payload.data;
}

const lifecycleOptions: Record<string, string[]> = {
  DRAFT: ["SCHEDULED", "ACTIVE"],
  SCHEDULED: ["DRAFT", "ACTIVE", "PAUSED", "ENDED"],
  ACTIVE: ["PAUSED", "ENDED"],
  PAUSED: ["ACTIVE", "ENDED"],
  ENDED: ["ARCHIVED"],
  ARCHIVED: [],
};

function optionalInstant(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? new Date(text).toISOString() : undefined;
}

export function PromotionOperations({ campaigns }: { campaigns: Campaign[] }) {
  const [message, setMessage] = useState("");

  async function run(action: () => Promise<unknown>) {
    try {
      const result = await action();
      setMessage(`Saved: ${JSON.stringify(result)}`);
      location.reload();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Promotion request failed",
      );
    }
  }

  return (
    <section id="promotions">
      <h2>Promotions / العروض</h2>
      <p>
        Create a sale or coupon using the checkout pricing engine. Percentage
        values use basis points: 1,500 equals 15%.
      </p>
      <details className="workflow-disclosure">
        <summary>Create a promotion campaign</summary>
        <form
          className="form-grid"
          action={(form) =>
            run(() => {
              const kind = String(form.get("kind"));
              const code = String(form.get("code") ?? "").trim();
              const scopeId = String(form.get("scopeId") ?? "").trim();
              const startsAt = optionalInstant(form.get("startsAt"));
              const endsAt = optionalInstant(form.get("endsAt"));
              return mutate("/api/v1/admin/promotions", "POST", {
                internalName: form.get("campaignName"),
                nameEn: form.get("campaignNameEn"),
                nameAr: form.get("campaignNameAr"),
                status: form.get("status"),
                startsAt,
                endsAt,
                rules: [
                  {
                    internalName: form.get("ruleName"),
                    nameEn: form.get("ruleNameEn"),
                    nameAr: form.get("ruleNameAr"),
                    kind,
                    applicationMethod:
                      kind === "COUPON" ? "MANUAL" : "AUTOMATIC",
                    reductionKind: form.get("reductionKind"),
                    reductionValue: Number(form.get("reductionValue")),
                    minimumMerchandiseFils: form.get("minimumMerchandiseFils")
                      ? Number(form.get("minimumMerchandiseFils"))
                      : 0,
                    priority: Number(form.get("priority")),
                    startsAt,
                    endsAt,
                    weekdays: String(form.get("weekdays") ?? "")
                      .split(",")
                      .map((value) => Number(value.trim()))
                      .filter(Boolean),
                    localStartTime:
                      String(form.get("localStartTime") ?? "").trim() ||
                      undefined,
                    localEndTime:
                      String(form.get("localEndTime") ?? "").trim() ||
                      undefined,
                    allowSaleCombination: form.get("allowSale") === "on",
                    allowCouponCombination: form.get("allowCoupon") === "on",
                    maximumUsesGlobal: form.get("maximumUses")
                      ? Number(form.get("maximumUses"))
                      : undefined,
                    maximumUsesPerAccount: form.get("maximumUsesPerAccount")
                      ? Number(form.get("maximumUsesPerAccount"))
                      : undefined,
                    budgetFils: form.get("budgetFils")
                      ? Number(form.get("budgetFils"))
                      : undefined,
                    eligibility: {
                      verified: form.get("verified") === "on",
                      firstOrder: form.get("firstOrder") === "on",
                      minimumQuantity: form.get("minimumQuantity")
                        ? Number(form.get("minimumQuantity"))
                        : undefined,
                      minimumAccountAgeDays: form.get("minimumAccountAgeDays")
                        ? Number(form.get("minimumAccountAgeDays"))
                        : undefined,
                    },
                    scopes: scopeId
                      ? [
                          {
                            effect: form.get("scopeEffect"),
                            scopeType: form.get("scopeType"),
                            scopeId,
                          },
                        ]
                      : [],
                    codes: kind === "COUPON" && code ? [code] : [],
                    enabled: form.get("enabled") === "on",
                  },
                ],
              });
            })
          }
        >
          <label>
            Internal campaign name
            <input
              name="campaignName"
              required
              placeholder="Internal campaign name"
            />
          </label>
          <label>
            Customer campaign name (English)
            <input
              name="campaignNameEn"
              required
              placeholder="Customer campaign name (English)"
            />
          </label>
          <label>
            اسم الحملة بالعربية
            <input
              name="campaignNameAr"
              required
              dir="rtl"
              placeholder="اسم الحملة بالعربية"
            />
          </label>
          <label>
            Status
            <select name="status" defaultValue="DRAFT">
              <option>DRAFT</option>
              <option>ACTIVE</option>
              <option>SCHEDULED</option>
            </select>
          </label>
          <label>
            Starts <input name="startsAt" type="datetime-local" />
          </label>
          <label>
            Ends <input name="endsAt" type="datetime-local" />
          </label>
          <label>
            Internal rule name
            <input name="ruleName" required placeholder="Internal rule name" />
          </label>
          <label>
            Rule name (English)
            <input
              name="ruleNameEn"
              required
              placeholder="Rule name (English)"
            />
          </label>
          <label>
            اسم القاعدة بالعربية
            <input
              name="ruleNameAr"
              required
              dir="rtl"
              placeholder="اسم القاعدة بالعربية"
            />
          </label>
          <label>
            Kind
            <select name="kind" defaultValue="SALE">
              <option>SALE</option>
              <option>COUPON</option>
            </select>
          </label>
          <label>
            Reduction Kind
            <select name="reductionKind" defaultValue="PERCENTAGE">
              <option>PERCENTAGE</option>
              <option>FIXED</option>
              <option>FIXED_FINAL_PRICE</option>
            </select>
          </label>
          <label>
            Basis points or fils
            <input
              name="reductionValue"
              type="number"
              min="1"
              required
              placeholder="Basis points or fils"
            />
          </label>
          <label>
            Minimum merchandise fils
            <input
              name="minimumMerchandiseFils"
              type="number"
              min="0"
              placeholder="Minimum merchandise fils"
            />
          </label>
          <label>
            Priority
            <input
              name="priority"
              type="number"
              defaultValue="0"
              required
              aria-label="Priority"
            />
          </label>
          <label>
            Optional global use limit
            <input
              name="maximumUses"
              type="number"
              min="1"
              placeholder="Optional global use limit"
            />
          </label>
          <label>
            Optional per-account use limit
            <input
              name="maximumUsesPerAccount"
              type="number"
              min="1"
              placeholder="Optional per-account use limit"
            />
          </label>
          <label>
            Optional budget in fils
            <input
              name="budgetFils"
              type="number"
              min="1"
              placeholder="Optional budget in fils"
            />
          </label>
          <label>
            Coupon code when kind is COUPON
            <input
              name="code"
              minLength={3}
              maxLength={64}
              placeholder="Coupon code when kind is COUPON"
            />
          </label>
          <label>
            Amman weekdays, e.g. 1,2,3
            <input
              name="weekdays"
              pattern="[1-7](,[1-7])*"
              placeholder="Amman weekdays, e.g. 1,2,3"
            />
          </label>
          <label>
            Local start <input name="localStartTime" type="time" />
          </label>
          <label>
            Local end <input name="localEndTime" type="time" />
          </label>
          <label>
            Scope Effect
            <select name="scopeEffect" defaultValue="INCLUDE">
              <option>INCLUDE</option>
              <option>EXCLUDE</option>
            </select>
          </label>
          <label>
            Scope Type
            <select name="scopeType" defaultValue="PRODUCT">
              <option>PRODUCT</option>
              <option>VARIANT</option>
              <option>CATEGORY</option>
              <option>COLLECTION</option>
              <option>ACCOUNT</option>
              <option>ACCOUNT_GROUP</option>
            </select>
          </label>
          <label>
            Optional scope UUID
            <input name="scopeId" placeholder="Optional scope UUID" />
          </label>
          <label>
            Optional minimum quantity
            <input
              name="minimumQuantity"
              type="number"
              min="1"
              placeholder="Optional minimum quantity"
            />
          </label>
          <label>
            Optional minimum account age (days)
            <input
              name="minimumAccountAgeDays"
              type="number"
              min="0"
              placeholder="Optional minimum account age (days)"
            />
          </label>
          <label className="check">
            <input name="verified" type="checkbox" /> Verified accounts only
          </label>
          <label className="check">
            <input name="firstOrder" type="checkbox" /> First completed order
            only
          </label>
          <label className="check">
            <input name="allowSale" type="checkbox" /> May combine with a sale
          </label>
          <label className="check">
            <input name="allowCoupon" type="checkbox" /> May combine with
            another coupon
          </label>
          <label className="check">
            <input name="enabled" type="checkbox" /> Enable the rule immediately
          </label>
          <button className="secondary">Create campaign</button>
        </form>
      </details>
      <details className="workflow-disclosure">
        <summary>Preview an authoritative quote</summary>
        <form
          className="form-grid"
          action={(form) =>
            run(() =>
              mutate("/api/v1/admin/promotions/preview", "POST", {
                accountId: form.get("accountId"),
                deliveryZoneId: form.get("deliveryZoneId"),
                couponCode:
                  String(form.get("previewCoupon") ?? "").trim() || undefined,
              }),
            )
          }
        >
          <strong>Quote preview / معاينة السعر</strong>
          <label>
            Customer account UUID
            <input
              name="accountId"
              required
              placeholder="Customer account UUID"
            />
          </label>
          <label>
            Delivery zone UUID
            <input
              name="deliveryZoneId"
              required
              placeholder="Delivery zone UUID"
            />
          </label>
          <label>
            Optional coupon code
            <input
              name="previewCoupon"
              minLength={3}
              maxLength={64}
              placeholder="Optional coupon code"
            />
          </label>
          <button className="secondary">Preview without consuming usage</button>
        </form>
      </details>
      <p className="operation-message" aria-live="polite">
        {message}
      </p>
      <div className="list">
        {campaigns.length ? (
          campaigns.map((campaign) => (
            <article key={campaign.public_id}>
              <div>
                <strong>
                  {campaign.name_en} / {campaign.name_ar}
                </strong>
                <small>
                  {campaign.internal_name} · {campaign.status} · used{" "}
                  {(Number(campaign.used_fils) / 1_000).toFixed(3)} JOD
                  {campaign.budget_fils
                    ? ` of ${(Number(campaign.budget_fils) / 1_000).toFixed(3)} JOD`
                    : ""}
                </small>
              </div>
              <div className="inline-actions">
                {lifecycleOptions[campaign.status]?.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() =>
                      run(() =>
                        mutate(
                          `/api/v1/admin/promotions/campaigns/${campaign.public_id}/lifecycle`,
                          "POST",
                          { status },
                        ),
                      )
                    }
                  >
                    {status}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    run(() =>
                      mutate(
                        `/api/v1/admin/promotions/campaigns/${campaign.public_id}/duplicate`,
                        "POST",
                        {
                          internalName: `${campaign.internal_name} copy`,
                          nameEn: `${campaign.name_en} copy`,
                          nameAr: `${campaign.name_ar} نسخة`,
                        },
                      ),
                    )
                  }
                >
                  Duplicate as draft
                </button>
              </div>
              <div className="list">
                {campaign.rules.map((rule) => (
                  <div key={rule.publicId} className="inline-actions">
                    <span>
                      {rule.nameEn} / {rule.nameAr} · v{rule.version} · priority{" "}
                      {rule.priority} · {rule.enabled ? "Enabled" : "Disabled"}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        run(() =>
                          mutate(
                            `/api/v1/admin/promotions/${rule.publicId}`,
                            "PATCH",
                            { enabled: !rule.enabled },
                          ),
                        )
                      }
                    >
                      {rule.enabled ? "Disable" : "Enable"}
                    </button>
                  </div>
                ))}
              </div>
            </article>
          ))
        ) : (
          <p>No campaigns yet.</p>
        )}
      </div>
    </section>
  );
}
