import { redirect } from "next/navigation";
import { DeliveryActions } from "@/components/delivery-actions";
import { DriverCashHandover } from "@/components/driver-cash-handover";
import { LocalizedText as T } from "@/components/language-provider";
import { apiGet, getSession } from "@/lib/api";

export const dynamic = "force-dynamic";

type CashPosition = { heldFils: number; pendingHandoverFils: number };

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

export default async function DeliveryDashboard() {
  const actor = await getSession();
  if (!actor) redirect("/");
  if (actor.role !== "DELIVERY_AGENT") redirect("/");

  const result = await apiGet<{
    assignments: Record<string, unknown>[];
    cashPosition: CashPosition;
  }>("/api/v1/deliveries");
  const assignments = result?.assignments ?? [];
  const cashPosition = result?.cashPosition ?? {
    heldFils: 0,
    pendingHandoverFils: 0,
  };

  return (
    <main className="page driver-dashboard">
      <header className="driver-page-heading">
        <p className="eyebrow">
          <T en="DELIVERY AGENT" ar="مندوب التوصيل" />
        </p>
        <h1>
          <T en="Today’s delivery desk" ar="مكتب توصيلات اليوم" />
        </h1>
        <p>
          <T
            en="Accept custody, record each attempt, and reconcile collected cash from one focused workspace."
            ar="استلم العهدة، وسجّل كل محاولة، وطابق النقد المحصّل من مساحة عمل واحدة مركّزة."
          />
        </p>
      </header>

      <DriverCashHandover {...cashPosition} />

      <section className="driver-assignment-section" aria-labelledby="assignments-title">
        <div className="driver-section-heading">
          <div>
            <p className="eyebrow">
              <T en="ACTIVE ROUTE" ar="المسار النشط" />
            </p>
            <h2 id="assignments-title">
              <T en="Assigned deliveries" ar="التوصيلات المسندة" />
            </h2>
          </div>
          <span className="driver-count">{assignments.length}</span>
        </div>
        {!assignments.length ? (
          <div className="driver-empty-state">
            <strong>
              <T en="No active assignments" ar="لا توجد مهام توصيل نشطة" />
            </strong>
            <p>
              <T
                en="New assignments will appear here after dispatch."
                ar="ستظهر المهام الجديدة هنا بعد الإرسال."
              />
            </p>
          </div>
        ) : (
          <div className="driver-assignment-list">
            {assignments.map((assignment) => {
              const recipient = assignment.recipient_snapshot as Record<
                string,
                unknown
              > | null;
              const publicId = text(assignment.public_id);
              const address = [
                recipient?.city,
                recipient?.area,
                recipient?.street,
                recipient?.building,
              ]
                .map(text)
                .filter(Boolean)
                .join(", ");
              return (
                <article className="driver-assignment-card" key={publicId}>
                  <header>
                    <div>
                      <span className="driver-order-reference">{publicId}</span>
                      <strong>{text(assignment.internal_reference)}</strong>
                    </div>
                    <span className="driver-state">{text(assignment.state)}</span>
                  </header>
                  <dl className="driver-assignment-details">
                    <div>
                      <dt><T en="Recipient" ar="المستلم" /></dt>
                      <dd>{text(recipient?.name)}</dd>
                    </div>
                    <div>
                      <dt><T en="Phone" ar="الهاتف" /></dt>
                      <dd>{text(recipient?.phone)}</dd>
                    </div>
                    <div>
                      <dt><T en="Attempt" ar="المحاولة" /></dt>
                      <dd>{Number(assignment.attempt_number) + 1} / 3</dd>
                    </div>
                    <div className="driver-address">
                      <dt><T en="Address" ar="العنوان" /></dt>
                      <dd>{address}</dd>
                    </div>
                  </dl>
                  <DeliveryActions
                    publicId={publicId}
                    paymentMethod={text(assignment.payment_method)}
                    doorstepAuthorized={Boolean(assignment.doorstep_authorized)}
                  />
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
