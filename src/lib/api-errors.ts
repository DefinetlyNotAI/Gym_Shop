export type LocalizedCopy = { en: string; ar: string };
export type ErrorNotice = {
  key: string;
  code: string;
  status: number;
  title: LocalizedCopy;
  description: LocalizedCopy;
  recovery: "none" | "signin" | "refresh" | "wait";
};
type Copy = Pick<ErrorNotice, "title" | "description" | "recovery">;
const copy = (
  enTitle: string,
  arTitle: string,
  en: string,
  ar: string,
  recovery: ErrorNotice["recovery"] = "none",
): Copy => ({
  title: { en: enTitle, ar: arTitle },
  description: { en, ar },
  recovery,
});
const generic = copy(
  "We couldn't complete that",
  "تعذّر إتمام الإجراء",
  "Review the current state before trying again. For orders or payments, check your order status first.",
  "راجع الحالة الحالية قبل المحاولة مجددًا. للطلبات أو المدفوعات، تحقق من حالة طلبك أولًا.",
);
const signin = copy(
  "Please sign in again",
  "سجّل الدخول مجددًا",
  "Your session may have expired. Sign in to continue; review your current orders before repeating a payment.",
  "قد تكون جلستك انتهت. سجّل الدخول للمتابعة، وراجع طلباتك الحالية قبل تكرار الدفع.",
  "signin",
);
const permission = copy(
  "This action isn't available",
  "هذا الإجراء غير متاح",
  "Your account does not have access to this action. Contact an authorized staff member if you need help.",
  "لا يملك حسابك صلاحية هذا الإجراء. تواصل مع موظف مخوّل إذا احتجت المساعدة.",
);
const validation = copy(
  "Check the entered information",
  "راجع المعلومات المدخلة",
  "Review the required fields and their allowed values, then submit again.",
  "راجع الحقول المطلوبة والقيم المسموح بها، ثم أرسل مجددًا.",
);
const stale = copy(
  "The information has changed",
  "تغيّرت المعلومات",
  "Refresh the page to see the latest state before submitting again.",
  "حدّث الصفحة لعرض أحدث حالة قبل الإرسال مجددًا.",
  "refresh",
);
const unavailable = copy(
  "The service is unavailable",
  "الخدمة غير متاحة",
  "Please try later. Check existing order or payment status before repeating a financial action.",
  "حاول لاحقًا. تحقق من حالة الطلب أو الدفع الحالي قبل تكرار إجراء مالي.",
  "wait",
);
const notices: Record<string, Copy> = {
  AUTH_REQUIRED: signin,
  SESSION_EXPIRED: signin,
  RECENT_AUTH_REQUIRED: signin,
  PERMISSION_DENIED: permission,
  FORBIDDEN: permission,
  CUSTOMER_ROLE_REQUIRED: permission,
  EMERGENCY_SESSION_RESTRICTED: permission,
  ORIGIN_REQUIRED: stale,
  ORIGIN_REJECTED: stale,
  FETCH_SITE_REJECTED: stale,
  VALIDATION_ERROR: validation,
  ACCOUNT_REQUIRED: signin,
  CURSOR_INVALID: stale,
  VERIFICATION_REQUIRED: copy(
    "Partner verification is required",
    "يلزم التحقق من الشريك",
    "Custom referral codes are available to approved verified partners. Review your partner verification status; your existing code still works.",
    "الرموز المخصصة متاحة للشركاء الذين تمت الموافقة على تحققهم. راجع حالة التحقق؛ لا يزال رمزك الحالي يعمل.",
  ),
  REFERRAL_CODE_INVALID: copy(
    "Check your referral code",
    "راجع رمز الإحالة",
    "Use 6–24 letters, numbers, underscores or hyphens. Your current referral code remains unchanged.",
    "استخدم 6–24 حرفًا لاتينيًا أو رقمًا أو شرطة سفلية أو شرطة. لم يتغير رمز الإحالة الحالي.",
  ),
  REFERRAL_CODE_UPDATE_FAILED: copy(
    "Your referral code couldn't be updated",
    "تعذّر تحديث رمز الإحالة",
    "Review your current referral code and verification status before trying another code.",
    "راجع رمز الإحالة الحالي وحالة التحقق قبل محاولة رمز آخر.",
  ),
  NOTIFICATION_UPDATE_FAILED: copy(
    "Notifications couldn't be updated",
    "تعذّر تحديث الإشعارات",
    "Refresh your notifications to check their current read state before trying again.",
    "حدّث الإشعارات للتحقق من حالة القراءة الحالية قبل المحاولة مجددًا.",
    "refresh",
  ),
  NOTIFICATIONS_UNAVAILABLE: unavailable,
  PREFERENCE_INVALID: copy(
    "Your marketing preference wasn't saved",
    "لم يتم حفظ تفضيل التسويق",
    "Refresh to review your current marketing preferences before submitting again. Required order and security messages stay separate.",
    "حدّث الصفحة لمراجعة تفضيلات التسويق الحالية قبل الإرسال مجددًا. تظل رسائل الطلبات والأمان الضرورية منفصلة.",
    "refresh",
  ),
  CLIPBOARD_UNAVAILABLE: copy(
    "The link couldn't be copied",
    "تعذّر نسخ الرابط",
    "Select the displayed referral link and copy it manually. Your referral code has not changed.",
    "حدّد رابط الإحالة المعروض وانسخه يدويًا. لم يتغير رمز الإحالة.",
  ),
  MESSAGE_INVALID: validation,
  WALLET_AMOUNT_INVALID: validation,
  MESSAGE_NOT_EDITABLE: copy(
    "This message can no longer be edited",
    "لم يعد تعديل هذه الرسالة متاحًا",
    "The ticket may be closed or the message may belong to someone else. Refresh or reopen the conversation to see the latest state.",
    "قد تكون التذكرة مغلقة أو الرسالة تخص شخصًا آخر. حدّث المحادثة أو أعد فتحها لعرض أحدث حالة.",
    "refresh",
  ),
  WALLET_BALANCE_INSUFFICIENT: copy(
    "Your wallet balance isn't enough",
    "رصيد المحفظة غير كافٍ",
    "Reduce the wallet amount or choose another available payment method.",
    "قلّل المبلغ المستخدم من المحفظة أو اختر وسيلة دفع أخرى متاحة.",
  ),
  POINT_BALANCE_INSUFFICIENT: copy(
    "Not enough reward points",
    "نقاط المكافآت غير كافية",
    "Choose a smaller amount and review your current points balance.",
    "اختر مبلغًا أقل وراجع رصيد نقاطك الحالي.",
  ),
  PAYOUT_PROVIDER_UNAVAILABLE: copy(
    "Wallet withdrawals aren't available",
    "سحب المحفظة غير متاح",
    "Withdrawals are not available: the provider's withdrawal capability has not been verified. No withdrawal can be requested or executed yet.",
    "لم يتم التحقق من قدرة المزوّد على السحب. لا يمكن طلب سحب أو تنفيذه بعد.",
  ),
  INSUFFICIENT_STOCK: copy(
    "An item is no longer available",
    "أحد المنتجات لم يعد متاحًا",
    "Review your cart and reduce the quantity or choose another variant.",
    "راجع السلة وقلّل الكمية أو اختر خيارًا آخر.",
    "refresh",
  ),
  CART_UPDATE_FAILED: copy(
    "Your cart couldn't be updated",
    "تعذّر تحديث السلة",
    "Review the current stock and quantity in your cart. Your last confirmed cart state is still shown.",
    "راجع المخزون والكمية الحالية في السلة. لا تزال آخر حالة مؤكدة للسلة معروضة.",
    "refresh",
  ),
  DRIVER_INVALID: copy(
    "Choose an active driver",
    "اختر سائقًا نشطًا",
    "Check the assigned driver's account UUID and active status before dispatching.",
    "تحقق من معرّف حساب السائق وحالته النشطة قبل الإرسال.",
  ),
  PICKUP_PIN_INVALID: copy(
    "Check the pickup PIN",
    "تحقق من رمز الاستلام",
    "Use the customer's current six-digit pickup PIN. Do not guess or bypass verification.",
    "استخدم رمز الاستلام الحالي المكوّن من ستة أرقام. لا تخمّن الرمز أو تتجاوز التحقق.",
  ),
  COLLECTION_MISMATCH: copy(
    "The collected amount doesn't match",
    "المبلغ المحصّل غير مطابق",
    "Review the authoritative amount due and enter the exact cash collected in fils. No collection is confirmed.",
    "راجع المبلغ المستحق وأدخل النقد المحصّل بالضبط بالفلس. لم يتم تأكيد التحصيل.",
  ),
  POINT_CONVERSION_WEEKLY_LIMIT: copy(
    "The weekly conversion limit was reached",
    "تم بلوغ حد التحويل الأسبوعي",
    "Review this week's remaining conversion blocks or wait until the next Amman week. Your points do not expire.",
    "راجع وحدات التحويل المتبقية لهذا الأسبوع أو انتظر بداية الأسبوع التالي بتوقيت عمّان. نقاطك لا تنتهي صلاحيتها.",
    "wait",
  ),
  POINT_CONVERSION_BLOCKS_INVALID: validation,
  VARIANT_ALREADY_AVAILABLE: copy(
    "This variant is back in stock",
    "هذا الخيار متوفر مجددًا",
    "Refresh the product to review current stock; a restock alert is no longer needed.",
    "حدّث المنتج لمراجعة المخزون الحالي؛ لم يعد تنبيه التوفر مطلوبًا.",
    "refresh",
  ),
  VARIANT_NOT_FOUND: stale,
  REASSIGNMENT_INVALID: stale,
  CART_EMPTY: copy(
    "Select items for checkout",
    "اختر منتجات للدفع",
    "Your selected cart is empty. Add or select an available item before checkout.",
    "السلة المختارة فارغة. أضف منتجًا متاحًا أو حدّده قبل الدفع.",
  ),
  DELIVERY_UNAVAILABLE: copy(
    "Delivery isn't available here",
    "التوصيل غير متاح هنا",
    "Choose another available delivery option or store pickup.",
    "اختر خيار توصيل آخر متاحًا أو الاستلام من المتجر.",
  ),
  PHONE_VERIFICATION_REQUIRED: copy(
    "Verify your phone first",
    "تحقق من هاتفك أولًا",
    "Open account settings and verify your phone before using this payment option.",
    "افتح إعدادات الحساب وتحقق من هاتفك قبل استخدام خيار الدفع هذا.",
  ),
  TERMS_VERSION_INVALID: stale,
  IDEMPOTENCY_CONFLICT: stale,
  DOORSTEP_TERMS_REQUIRED: copy(
    "Delivery consent is required",
    "موافقة التسليم مطلوبة",
    "Review the delivery notice and select the required consent before submitting.",
    "راجع إشعار التسليم وحدّد الموافقة المطلوبة قبل الإرسال.",
  ),
  COUPON_NOT_ELIGIBLE: copy(
    "This coupon can't be applied",
    "لا يمكن تطبيق هذه القسيمة",
    "Check the coupon's conditions, change your cart or remove the coupon to continue.",
    "راجع شروط القسيمة أو غيّر السلة أو أزل القسيمة للمتابعة.",
  ),
  MEDIA_NOT_READY: copy(
    "Your upload isn't ready",
    "الملف المرفوع غير جاهز",
    "Wait for the security scan to finish before using this upload.",
    "انتظر انتهاء الفحص الأمني قبل استخدام الملف المرفوع.",
    "wait",
  ),
  TICKET_MEDIA_INVALID: validation,
  ASSIGNEE_INVALID: validation,
  TICKET_NOT_FOUND: stale,
  ORDER_NOT_FOUND: stale,
  NOT_FOUND: stale,
  ACCOUNT_INACTIVE: permission,
  ACCOUNT_RESTRICTED: permission,
  RATE_LIMITED: copy(
    "Please slow down",
    "انتظر قليلًا",
    "Too many requests were made. Wait before trying again.",
    "تم إرسال طلبات كثيرة. انتظر قبل المحاولة مجددًا.",
    "wait",
  ),
  INVALID_CREDENTIALS: copy(
    "Sign-in wasn't successful",
    "لم ينجح تسجيل الدخول",
    "Check your email and password, or use the password recovery flow.",
    "راجع بريدك وكلمة المرور، أو استخدم استعادة كلمة المرور.",
  ),
  NETWORK_ERROR: copy(
    "We couldn't reach the service",
    "تعذّر الاتصال بالخدمة",
    "Check your connection. For an order or payment, check its current status before trying again.",
    "تحقق من اتصالك. للطلب أو الدفع، راجع حالته الحالية قبل المحاولة مجددًا.",
  ),
  INVALID_RESPONSE: unavailable,
};
function safeCode(value: unknown): string {
  return typeof value === "string" && /^[A-Z][A-Z0-9_]{0,79}$/.test(value)
    ? value
    : "REQUEST_FAILED";
}
function fallback(status: number): Copy {
  if (status === 401) return signin;
  if (status === 403) return permission;
  if (status === 400 || status === 422) return validation;
  if (status === 409 || status === 404) return stale;
  if (status === 429) return notices.RATE_LIMITED;
  if (status >= 500) return unavailable;
  return generic;
}
export class ApiFailure extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 0) {
    const safe = safeCode(code);
    super(
      (Object.hasOwn(notices, safe) ? notices[safe] : fallback(status))
        .description.en,
    );
    this.name = "ApiFailure";
    this.code = safe;
    this.status = status;
  }
}
export function apiErrorFromPayload(
  payload: unknown,
  status: number,
): ApiFailure {
  const error =
    payload && typeof payload === "object" && "error" in payload
      ? payload.error
      : null;
  const code =
    error && typeof error === "object" && "code" in error ? error.code : null;
  return new ApiFailure(safeCode(code), status);
}
export async function readApiData<T>(response: Response): Promise<T> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw apiErrorFromPayload(payload, response.status);
  if (
    !payload ||
    typeof payload !== "object" ||
    !("data" in payload) ||
    payload.data == null
  )
    throw new ApiFailure("INVALID_RESPONSE", response.status);
  return payload.data as T;
}

export function errorNotice(error: unknown): ErrorNotice {
  const failure =
    error instanceof ApiFailure
      ? error
      : new ApiFailure(
          error instanceof TypeError
            ? "NETWORK_ERROR"
            : error instanceof Error
              ? safeCode(error.message)
              : "REQUEST_FAILED",
        );
  const selected = Object.hasOwn(notices, failure.code)
    ? notices[failure.code]
    : fallback(failure.status);
  return {
    key: failure.code + ":" + failure.status,
    code: failure.code,
    status: failure.status,
    ...selected,
  };
}
export function appendNotice(
  current: ErrorNotice[],
  notice: ErrorNotice,
): ErrorNotice[] {
  return current.some((item) => item.key === notice.key)
    ? current
    : [...current, notice];
}
export const API_ERROR_EVENT = "gymshop:api-error";
const reported = new WeakSet<object>();
export function presentApiError(error: unknown): string {
  const notice = errorNotice(error);
  if (
    typeof window !== "undefined" &&
    !(error && typeof error === "object" && reported.has(error))
  ) {
    if (error && typeof error === "object") reported.add(error);
    window.dispatchEvent(
      new CustomEvent<ErrorNotice>(API_ERROR_EVENT, { detail: notice }),
    );
  }
  return typeof document !== "undefined" &&
    document.documentElement.lang === "ar"
    ? notice.description.ar
    : notice.description.en;
}
