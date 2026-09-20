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
  PROFILE_UPDATE_FAILED: copy(
    "Your profile couldn't be saved",
    "تعذّر حفظ ملفك الشخصي",
    "Review your name and international phone format. Check your current profile before submitting again; a recent sign-in may be required.",
    "راجع اسمك وتنسيق رقم الهاتف الدولي. تحقّق من ملفك الحالي قبل الإرسال مجدداً؛ قد يلزم تسجيل دخول حديث.",
  ),
  ADDRESS_FAILED: copy(
    "Your address couldn't be updated",
    "تعذّر تحديث عنوانك",
    "Review the address fields and your saved address list before submitting again. Your entered details remain available.",
    "راجع حقول العنوان وقائمة عناوينك المحفوظة قبل الإرسال مجدداً. تظل التفاصيل التي أدخلتها متاحة.",
  ),
  ADDRESS_NOT_FOUND: copy(
    "This saved address is no longer available",
    "لم يعد هذا العنوان المحفوظ متاحاً",
    "Refresh your saved addresses before editing or deleting again. Your draft remains available until you leave the page.",
    "حدّث عناوينك المحفوظة قبل التعديل أو الحذف مجدداً. تظل مسودتك متاحة حتى مغادرة الصفحة.",
    "refresh",
  ),
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
  CLAIM_INVALID: copy(
    "Check your damage report",
    "راجع بلاغ التلف",
    "Choose an item, enter a valid quantity, add at least ten characters of detail, and attach a photo.",
    "اختر منتجاً وكمية صحيحة، وأضف وصفاً من عشرة أحرف على الأقل، وأرفق صورة.",
  ),
  CLAIM_NOT_ELIGIBLE: copy(
    "This item is not eligible for a damage claim",
    "هذا المنتج غير مؤهل لمطالبة تلف",
    "Damage reports are available for delivered items owned by this account. Review the order or contact support.",
    "بلاغات التلف متاحة للمنتجات المسلّمة والتابعة لهذا الحساب. راجع الطلب أو تواصل مع الدعم.",
  ),
  CLAIM_WINDOW_EXPIRED: copy(
    "The damage-report window has ended",
    "انتهت مهلة الإبلاغ عن التلف",
    "Damage reports must be submitted within seven days of delivery. Contact support for other order help.",
    "يجب إرسال بلاغ التلف خلال سبعة أيام من التسليم. تواصل مع الدعم للمساعدة في أمور الطلب الأخرى.",
  ),
  CLAIM_QUANTITY_EXCEEDED: copy(
    "Check the damaged quantity",
    "راجع الكمية التالفة",
    "The quantity cannot exceed the eligible, non-refunded quantity on this order line.",
    "لا يمكن أن تتجاوز الكمية عدد المنتجات المؤهلة وغير المستردة في هذا البند.",
  ),
  CLAIM_MEDIA_REQUIRED: copy(
    "Photo evidence is required",
    "الدليل المصور مطلوب",
    "Attach at least one clear private image before submitting the damage report.",
    "أرفق صورة خاصة واضحة واحدة على الأقل قبل إرسال بلاغ التلف.",
  ),
  CLAIM_DECISION_INVALID: copy(
    "Review the claim decision",
    "راجع قرار المطالبة",
    "Choose replacement, refund, or rejection and provide a clear customer-facing reason.",
    "اختر الاستبدال أو الاسترداد أو الرفض، وأدخل سبباً واضحاً يظهر للعميل.",
  ),
  CLAIM_NOT_DECIDABLE: copy(
    "This claim was already decided",
    "تم البت في هذه المطالبة",
    "Refresh the conversation to see its current state. No second decision was recorded.",
    "حدّث المحادثة للاطلاع على حالتها الحالية. لم يتم تسجيل قرار ثانٍ.",
    "refresh",
  ),
  REPLACEMENT_STOCK_UNAVAILABLE: copy(
    "Replacement stock is unavailable",
    "مخزون الاستبدال غير متاح",
    "No replacement was created. Review current stock before choosing another claim outcome.",
    "لم يتم إنشاء طلب استبدال. راجع المخزون الحالي قبل اختيار نتيجة أخرى للمطالبة.",
    "refresh",
  ),
  REFUND_EXCEEDS_COLLECTED: copy(
    "The refund exceeds the collected amount",
    "الاسترداد يتجاوز المبلغ المحصل",
    "Review the amount already collected and refunded before requesting another refund.",
    "راجع المبلغ المحصل والمسترد سابقاً قبل طلب استرداد آخر.",
    "refresh",
  ),
  UPLOAD_TRANSFER_FAILED: copy(
    "The image could not be uploaded",
    "تعذّر رفع الصورة",
    "Check your connection and select the image again. The damage report has not been submitted.",
    "تحقق من اتصالك واختر الصورة مجدداً. لم يتم إرسال بلاغ التلف.",
  ),
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
  ZONE_CREATE_INVALID: copy(
    "Review the service zone",
    "راجع منطقة الخدمة",
    "Check both names, integer fee and day values, operating window, and capacity. Your entered values remain available.",
    "تحقق من الاسمين والرسوم والأيام كأعداد صحيحة ونافذة التشغيل والسعة. تظل القيم المدخلة متاحة.",
  ),
  ZONE_CREATE_FAILED: copy(
    "The service zone wasn't created",
    "لم يتم إنشاء منطقة الخدمة",
    "Review the zone configuration and current service list before submitting again. Your entered values remain available.",
    "راجع إعداد المنطقة وقائمة الخدمة الحالية قبل الإرسال مجدداً. تظل القيم المدخلة متاحة.",
    "refresh",
  ),
  PICKUP_CREATE_INVALID: copy(
    "Review the pickup location",
    "راجع موقع الاستلام",
    "Enter both location names, a customer-ready address, and clear opening hours. Your entered values remain available.",
    "أدخل اسمي الموقع وعنواناً واضحاً للعملاء وساعات عمل محددة. تظل القيم المدخلة متاحة.",
  ),
  PICKUP_CREATE_FAILED: copy(
    "The pickup location wasn't created",
    "لم يتم إنشاء موقع الاستلام",
    "Review the location details and current pickup list before submitting again. Your entered values remain available.",
    "راجع تفاصيل الموقع وقائمة مواقع الاستلام الحالية قبل الإرسال مجدداً. تظل القيم المدخلة متاحة.",
    "refresh",
  ),
  SETTING_UPDATE_INVALID: copy(
    "Review the launch setting",
    "راجع إعداد التشغيل",
    "Choose a supported setting value and include a clear audit reason before saving.",
    "اختر قيمة إعداد مدعومة وأدخل سبباً واضحاً للتدقيق قبل الحفظ.",
  ),
  SETTING_UPDATE_FAILED: copy(
    "The launch setting wasn't saved",
    "لم يتم حفظ إعداد التشغيل",
    "Review the current readiness state and sign-in freshness before saving the setting again.",
    "راجع حالة الجاهزية الحالية وحداثة تسجيل الدخول قبل حفظ الإعداد مجدداً.",
    "refresh",
  ),
  STOREFRONT_ACTIVATION_BLOCKED: copy(
    "Launch requirements are still open",
    "متطلبات الإطلاق ما زالت مفتوحة",
    "Resolve every item in the readiness list before enabling the storefront.",
    "عالج جميع البنود في قائمة الجاهزية قبل تفعيل المتجر.",
    "refresh",
  ),
  TERMS_CREATE_INVALID: copy(
    "Review the bilingual terms",
    "راجع الشروط باللغتين",
    "Enter a version, both titles, and substantive reviewed English and Arabic terms. Your draft remains available.",
    "أدخل الإصدار والعنوانين ونصوص الشروط المعتمدة بالإنجليزية والعربية. تظل المسودة متاحة.",
  ),
  TERMS_CREATE_DENIED: copy(
    "The terms weren't published",
    "لم يتم نشر الشروط",
    "A recent authorized sign-in is required to publish immutable terms. Your draft remains available.",
    "يلزم تسجيل دخول حديث ومخوّل لنشر شروط ثابتة. تظل المسودة متاحة.",
    "signin",
  ),
  EVIDENCE_INVALID: copy(
    "Review the recovery-drill evidence",
    "راجع دليل تمرين الاسترداد",
    "Choose the real drill result and add at least ten characters describing participants, keys, outcome, and follow-up.",
    "اختر نتيجة التمرين الفعلية وأضف وصفاً للمشاركين والمفاتيح والنتيجة والمتابعة لا يقل عن عشرة أحرف.",
  ),
  RETURN_INSPECTION_INVALID: copy(
    "Review the return inspection",
    "راجع فحص المرتجع",
    "Enter the returned order reference, choose its condition, and provide a clear inspection reason.",
    "أدخل مرجع الطلب المرتجع، واختر حالته، وقدّم سبباً واضحاً للفحص.",
  ),
  RETURN_NOT_PENDING: copy(
    "This order has no pending return",
    "لا يوجد مرتجع معلّق لهذا الطلب",
    "Refresh the inventory page and confirm the order is waiting for return inspection before recording a condition.",
    "حدّث صفحة المخزون وتأكد من أن الطلب بانتظار فحص المرتجع قبل تسجيل حالته.",
    "refresh",
  ),
  DISCREPANCY_INVALID: copy(
    "Review the cash discrepancy",
    "راجع فرق النقد",
    "Check the active driver UUID, integer fils amounts, source reference, and explanation before recording the discrepancy.",
    "تحقق من معرّف المندوب النشط، والمبالغ الصحيحة بالفلس، ومرجع المصدر، والتوضيح قبل تسجيل الفرق.",
  ),
  TEMPLATE_INVALID: copy(
    "Review the notification template",
    "راجع قالب الإشعار",
    "Use a versioned event name, select a channel and language, and provide valid subject, body, and variable fields.",
    "استخدم اسم حدث يتضمن الإصدار، واختر القناة واللغة، وأدخل حقول العنوان والنص والمتغيرات بشكل صحيح.",
  ),
  TEMPLATE_VARIABLE_NOT_ALLOWED: copy(
    "A template variable is not allowed",
    "أحد متغيرات القالب غير مسموح",
    "Add every {{placeholder}} used by the subject or body to the allowed-variable list, or remove it from the template.",
    "أضف كل عنصر نائب مستخدم في العنوان أو النص إلى قائمة المتغيرات المسموحة، أو أزله من القالب.",
  ),
  AMOUNT_INVALID: copy(
    "Review the handover amount",
    "راجع مبلغ التسليم",
    "Enter a positive whole number of fils that matches the cash physically handed to finance.",
    "أدخل عدداً صحيحاً موجباً بالفلس يطابق النقد الذي سُلّم فعلياً للمالية.",
  ),
  HANDOVER_EXCEEDS_HELD: copy(
    "The amount exceeds available cash",
    "المبلغ يتجاوز النقد المتاح",
    "Review your current cash custody and pending handovers, then enter no more than the amount still available to hand over.",
    "راجع عهدة النقد الحالية والتسليمات المعلّقة، ثم أدخل مبلغاً لا يتجاوز المتاح للتسليم.",
    "refresh",
  ),
  HANDOVER_FAILED: copy(
    "The handover wasn't recorded",
    "لم يتم تسجيل التسليم",
    "Keep the physical handover evidence and refresh your cash position before recording it again.",
    "احتفظ بإثبات التسليم الفعلي وحدّث حالة النقد قبل تسجيله مجدداً.",
    "refresh",
  ),
  DELIVERY_ACTION_INVALID: validation,
  ASSIGNMENT_NOT_FOUND: copy(
    "This assignment is no longer active",
    "لم تعد هذه المهمة نشطة",
    "Refresh your assigned deliveries before recording another custody or delivery action.",
    "حدّث مهام التوصيل المسندة قبل تسجيل إجراء عهدة أو توصيل آخر.",
    "refresh",
  ),
  ATTEMPT_LIMIT: copy(
    "No delivery attempts remain",
    "لا توجد محاولات توصيل متبقية",
    "This delivery has reached its attempt limit. Refresh the route and return the package through the required inventory workflow.",
    "بلغ هذا التوصيل حد المحاولات. حدّث المسار وأعد الطرد عبر دورة المخزون المطلوبة.",
    "refresh",
  ),
  PIN_REQUIRED: copy(
    "Use the current customer PIN",
    "استخدم رمز العميل الحالي",
    "Enter the customer's current six-digit PIN. Do not guess or bypass attended-delivery verification.",
    "أدخل رمز العميل الحالي المكوّن من ستة أرقام. لا تخمّن الرمز أو تتجاوز تحقق التسليم المباشر.",
  ),
  DRIVER_CASH_LIMIT: copy(
    "Cash custody is at its limit",
    "بلغت عهدة النقد حدّها",
    "Hand over collected cash to finance and wait for independent verification before accepting more cash exposure.",
    "سلّم النقد المحصّل للمالية وانتظر التحقق المستقل قبل قبول عهدة نقد إضافية.",
  ),
  DOORSTEP_NOT_ALLOWED: copy(
    "Doorstep delivery isn't authorized",
    "التسليم عند الباب غير مصرح",
    "Use attended delivery with the customer PIN unless this order explicitly authorizes doorstep delivery.",
    "استخدم التسليم المباشر مع رمز العميل ما لم يصرّح هذا الطلب بالتسليم عند الباب صراحةً.",
  ),
  DOORSTEP_PROOF_REQUIRED: copy(
    "Add complete doorstep proof",
    "أضف إثباتاً كاملاً للتسليم عند الباب",
    "Upload a clean proof image and enter valid latitude and longitude before completing the delivery.",
    "ارفع صورة إثبات سليمة وأدخل خط العرض وخط الطول الصحيحين قبل إكمال التسليم.",
  ),
  PROOF_REQUIRED: copy(
    "Delivery proof is required",
    "إثبات التوصيل مطلوب",
    "Upload the required private proof before completing this delivery.",
    "ارفع الإثبات الخاص المطلوب قبل إكمال هذا التوصيل.",
  ),
  DELIVERY_PROOF_INVALID: copy(
    "The delivery proof isn't ready",
    "إثبات التوصيل غير جاهز",
    "Choose a successfully uploaded, clean proof image that belongs to this delivery.",
    "اختر صورة إثبات رُفعت بنجاح وثبتت سلامتها وتخص هذا التوصيل.",
  ),
  RECOVERY_RESEND_INVALID: validation,
  RECOVERY_SEND_COOLDOWN: copy(
    "Wait before requesting another code",
    "انتظر قبل طلب رمز آخر",
    "A replacement code can be sent once per minute. Use the newest code or wait for the resend timer.",
    "يمكن إرسال رمز بديل مرة واحدة كل دقيقة. استخدم أحدث رمز أو انتظر مؤقت إعادة الإرسال.",
    "wait",
  ),
  RECOVERY_SEND_LIMIT: copy(
    "The recovery send limit was reached",
    "تم بلوغ حد إرسال رموز الاسترداد",
    "This recovery was stopped for security after repeated sends. Restart recovery and complete each factor using the newest code.",
    "تم إيقاف هذا الاسترداد أمنياً بعد تكرار الإرسال. أعد بدء الاسترداد وأكمل كل عامل باستخدام أحدث رمز.",
  ),
  RECOVERY_EXPIRED: copy(
    "This recovery has expired",
    "انتهت صلاحية عملية الاسترداد",
    "Restart recovery. All five factors must be completed within the thirty-minute security window.",
    "أعد بدء الاسترداد. يجب إكمال العوامل الخمسة خلال مهلة الأمان البالغة ثلاثين دقيقة.",
  ),
  RECOVERY_STEP_OUT_OF_ORDER: copy(
    "This recovery step is no longer current",
    "لم تعد خطوة الاسترداد هذه حالية",
    "Restart recovery if the page was restored or used in another tab, then complete the factors in order.",
    "أعد بدء الاسترداد إذا استُعيدت الصفحة أو استُخدمت في تبويب آخر، ثم أكمل العوامل بالترتيب.",
    "refresh",
  ),
  RECOVERY_FACTOR_UNAVAILABLE: copy(
    "A required recovery factor is unavailable",
    "أحد عوامل الاسترداد المطلوبة غير متاح",
    "The registered security contact or key is incomplete. Recovery cannot bypass a missing factor.",
    "جهة اتصال الأمان أو المفتاح المسجّل غير مكتمل. لا يمكن للاسترداد تجاوز عامل مفقود.",
  ),
  RECOVERY_PROOF_INVALID: copy(
    "The security proof wasn't accepted",
    "لم يتم قبول إثبات الأمان",
    "Use the newest code, exact saved passphrase, or registered security key for the current step.",
    "استخدم أحدث رمز أو عبارة الاسترداد المحفوظة بدقة أو مفتاح الأمان المسجّل للخطوة الحالية.",
  ),
  RECOVERY_SECRET_ALREADY_CONSUMED: copy(
    "This recovery passphrase was already used",
    "استُخدمت عبارة الاسترداد هذه مسبقاً",
    "Restart through the approved recovery process. A consumed one-time passphrase cannot be reused.",
    "أعد البدء عبر عملية الاسترداد المعتمدة. لا يمكن إعادة استخدام عبارة استرداد أحادية الاستخدام بعد استهلاكها.",
  ),
  RECOVERY_RESEND_FAILED: unavailable,
  RECOVERY_FAILED: copy(
    "Recovery couldn't continue",
    "تعذّرت متابعة الاسترداد",
    "Review the current factor and use its newest proof. Restart if the thirty-minute recovery window expired.",
    "راجع عامل الأمان الحالي واستخدم أحدث إثبات له. أعد البدء إذا انتهت مهلة الاسترداد البالغة ثلاثين دقيقة.",
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
  PHONE_INVALID: copy(
    "Check your phone number",
    "راجع رقم هاتفك",
    "Enter your Jordan phone number starting with +962, without spaces.",
    "أدخل رقم هاتفك الأردني بدءًا بـ ‎+962 دون مسافات.",
  ),
  EMAIL_VERIFICATION_REQUIRED: copy(
    "Verify your email first",
    "تحقق من بريدك الإلكتروني أولًا",
    "Complete email verification before requesting a phone verification code.",
    "أكمل التحقق من بريدك الإلكتروني قبل طلب رمز التحقق من الهاتف.",
  ),
  PHONE_CODE_INVALID: copy(
    "This code couldn't verify your phone",
    "تعذّر التحقق من هاتفك بهذا الرمز",
    "Use the latest six-digit code for this number. It may have expired or been replaced; repeated incorrect attempts invalidate it. Request a new code if needed.",
    "استخدم أحدث رمز من ستة أرقام لهذا الرقم. ربما انتهت صلاحيته أو استُبدل؛ تُبطله المحاولات الخاطئة المتكررة. اطلب رمزًا جديدًا عند الحاجة.",
  ),
  PHONE_VERIFICATION_FAILED: copy(
    "Phone verification couldn't be completed",
    "تعذّر إكمال التحقق من الهاتف",
    "Your phone verification is not confirmed. Check your account and the latest code before trying again; no attempt is retried automatically.",
    "لم يتأكد التحقق من هاتفك. راجع حسابك وأحدث رمز قبل المحاولة مجددًا؛ لا تُعاد أي محاولة تلقائيًا.",
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
