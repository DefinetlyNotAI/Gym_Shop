"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { useApiAction } from "@/components/use-api-action";
import {
  addressInput,
  saveProfile,
  saveAccountAddress,
  removeAccountAddress,
} from "@/lib/account-profile";
type Address = {
  id: string;
  recipient: string;
  phone_e164: string;
  country: string;
  city: string;
  area: string;
  street: string;
  building: string | null;
  floor: string | null;
  unit: string | null;
  landmark: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  shipping_default: boolean;
  billing_default: boolean;
};
type Account = { displayName: string; phone?: string | null };

export function ProfileAddresses({
  account,
  initialAddresses,
}: {
  account: Account;
  initialAddresses: Address[];
}) {
  const { language } = useLanguage();
  const t = (en: string, ar: string) => (language === "ar" ? ar : en);
  const router = useRouter();
  const [creationVersion, setCreationVersion] = useState(0);
  const { pending, perform, message, live } = useApiAction();
  async function saveAddress(form: FormData, id?: string) {
    await perform(
      async () => {
        await saveAccountAddress(addressInput(form), id);
        if (id === undefined) setCreationVersion((version) => version + 1);
        router.refresh();
      },
      {
        en: "Address saved. Your saved address list is refreshing.",
        ar: "تم حفظ العنوان. جارٍ تحديث قائمة عناوينك المحفوظة.",
      },
    );
  }
  return (
    <>
      <section className="panel">
        <h2>{t("Profile", "الملف الشخصي")}</h2>
        <p id="profile-phone-help">
          {t(
            "Changing your phone number requires fresh WhatsApp verification before checkout. Profile changes require a recent sign-in.",
            "يتطلب تغيير رقم هاتفك تحققاً جديداً عبر واتساب قبل إتمام الطلب. يتطلب تعديل الملف تسجيل دخول حديثاً.",
          )}
        </p>
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void perform(
              async () => {
                await saveProfile({
                  displayName: String(form.get("displayName") ?? ""),
                  phone: String(form.get("phone") ?? ""),
                });
                router.refresh();
              },
              {
                en: "Profile saved. If your phone changed, verify it again before checkout.",
                ar: "تم حفظ الملف. إذا تغيّر رقم هاتفك، تحقّق منه مجدداً قبل إتمام الطلب.",
              },
            );
          }}
        >
          <label>
            {t("Name", "الاسم")}
            <input
              name="displayName"
              required
              minLength={2}
              maxLength={100}
              defaultValue={account.displayName}
              disabled={pending}
              autoComplete="name"
            />
          </label>
          <label>
            {t("Phone", "الهاتف")}
            <input
              name="phone"
              required
              pattern="\+[1-9][0-9]{7,14}"
              type="tel"
              dir="ltr"
              aria-describedby="profile-phone-help"
              defaultValue={account.phone ?? ""}
              disabled={pending}
              autoComplete="tel"
            />
          </label>
          <button className="secondary" disabled={pending}>
            {t(
              pending ? "Saving…" : "Save profile",
              pending ? "جارٍ الحفظ…" : "حفظ الملف",
            )}
          </button>
        </form>
      </section>
      <section className="panel">
        <div className="notice-heading">
          <h2>{t("Saved addresses", "العناوين المحفوظة")}</h2>
          <span className="status-badge">{initialAddresses.length}</span>
        </div>
        <details>
          <summary>{t("Add an address", "إضافة عنوان")}</summary>
          <AddressForm
            key={creationVersion}
            pending={pending}
            onSubmit={saveAddress}
          />
        </details>
        {initialAddresses.length === 0 ? (
          <p>
            {t(
              "No saved addresses yet. Add one to make checkout easier.",
              "لا توجد عناوين محفوظة بعد. أضف عنواناً لتسهيل إتمام الطلب.",
            )}
          </p>
        ) : null}
        <div className="list">
          {initialAddresses.map((address) => (
            <article key={address.id}>
              <details>
                <summary>
                  {address.recipient} · {address.city}, {address.area}
                </summary>
                <div className="action-row">
                  {address.shipping_default ? (
                    <span className="status-badge">
                      {t("Default shipping", "عنوان الشحن الافتراضي")}
                    </span>
                  ) : null}
                  {address.billing_default ? (
                    <span className="status-badge">
                      {t("Default billing", "عنوان الفوترة الافتراضي")}
                    </span>
                  ) : null}
                </div>
                <AddressForm
                  address={address}
                  pending={pending}
                  onSubmit={(form) => saveAddress(form, address.id)}
                />
                <details className="notification-diagnostics">
                  <summary>
                    {t("Remove this address", "حذف هذا العنوان")}
                  </summary>
                  <p>
                    {t(
                      "This removes the address from your saved list, not from existing orders.",
                      "سيُحذف العنوان من قائمتك المحفوظة، وليس من الطلبات السابقة.",
                    )}
                  </p>
                  <button
                    className="secondary"
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      void perform(
                        async () => {
                          await removeAccountAddress(address.id);
                          router.refresh();
                        },
                        {
                          en: "Address deleted. Your saved list is refreshing.",
                          ar: "تم حذف العنوان. جارٍ تحديث قائمتك المحفوظة.",
                        },
                      )
                    }
                  >
                    {t("Confirm deletion", "تأكيد الحذف")}
                  </button>
                </details>
              </details>
            </article>
          ))}
        </div>
      </section>
      <p aria-live={live}>{message}</p>
    </>
  );
}
function AddressForm({
  address,
  pending,
  onSubmit,
}: {
  address?: Address;
  pending: boolean;
  onSubmit: (form: FormData) => Promise<void>;
}) {
  const { language } = useLanguage();
  const t = (en: string, ar: string) => (language === "ar" ? ar : en);
  const fields = [
    {
      name: "recipient",
      en: "Recipient",
      ar: "المستلم",
      value: address?.recipient,
      min: 2,
      max: 100,
      autocomplete: "name",
    },
    {
      name: "phone",
      en: "Phone",
      ar: "الهاتف",
      value: address?.phone_e164,
      min: 8,
      max: 20,
      autocomplete: "tel",
    },
    {
      name: "country",
      en: "Country",
      ar: "الدولة",
      value: address?.country ?? "Jordan",
      min: 1,
      autocomplete: "country-name",
    },
    {
      name: "city",
      en: "City",
      ar: "المدينة",
      value: address?.city,
      min: 2,
      max: 100,
      autocomplete: "address-level2",
    },
    {
      name: "area",
      en: "Area",
      ar: "المنطقة",
      value: address?.area,
      min: 2,
      max: 100,
      autocomplete: "address-level3",
    },
    {
      name: "street",
      en: "Street",
      ar: "الشارع",
      value: address?.street,
      min: 2,
      max: 200,
      autocomplete: "address-line1",
    },
    {
      name: "building",
      en: "Building",
      ar: "المبنى",
      value: address?.building,
      max: 100,
    },
    {
      name: "floor",
      en: "Floor",
      ar: "الطابق",
      value: address?.floor,
      max: 30,
    },
    { name: "unit", en: "Unit", ar: "الشقة", value: address?.unit, max: 30 },
    {
      name: "landmark",
      en: "Landmark",
      ar: "علامة مميزة",
      value: address?.landmark,
      max: 300,
    },
  ];
  return (
    <form
      className="form-grid"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(new FormData(event.currentTarget));
      }}
    >
      {fields.map((field) => (
        <label key={field.name}>
          {t(field.en, field.ar)}
          {!field.min ? <small>{t("Optional", "اختياري")}</small> : null}
          <input
            name={field.name}
            required={Boolean(field.min)}
            minLength={field.min}
            maxLength={field.max}
            defaultValue={field.value ?? ""}
            disabled={pending}
            autoComplete={field.autocomplete}
            type={field.name === "phone" ? "tel" : "text"}
            dir={field.name === "phone" ? "ltr" : undefined}
          />
        </label>
      ))}
      <label>
        {t("Latitude (optional)", "خط العرض (اختياري)")}
        <input
          name="latitude"
          type="number"
          dir="ltr"
          min={-90}
          max={90}
          step="any"
          defaultValue={address?.latitude ?? ""}
          disabled={pending}
        />
      </label>
      <label>
        {t("Longitude (optional)", "خط الطول (اختياري)")}
        <input
          name="longitude"
          type="number"
          dir="ltr"
          min={-180}
          max={180}
          step="any"
          defaultValue={address?.longitude ?? ""}
          disabled={pending}
        />
      </label>
      <label className="check">
        <input
          name="shippingDefault"
          key={`shipping-${address?.shipping_default ?? false}`}
          type="checkbox"
          defaultChecked={address?.shipping_default}
          disabled={pending}
        />
        {t("Default shipping address", "عنوان الشحن الافتراضي")}
      </label>
      <label className="check">
        <input
          name="billingDefault"
          key={`billing-${address?.billing_default ?? false}`}
          type="checkbox"
          defaultChecked={address?.billing_default}
          disabled={pending}
        />
        {t("Default billing address", "عنوان الفوترة الافتراضي")}
      </label>
      <button className="secondary" disabled={pending}>
        {t(
          pending ? "Saving…" : "Save address",
          pending ? "جارٍ الحفظ…" : "حفظ العنوان",
        )}
      </button>
    </form>
  );
}
