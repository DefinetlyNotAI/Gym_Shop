import type { LocalizedCopy } from "@/lib/api-errors";

type BlockerCopy = { title: LocalizedCopy; description: LocalizedCopy };
const blockers: Record<string, BlockerCopy> = {
  CTO_SETUP_INCOMPLETE: { title: { en: "Owner setup is incomplete", ar: "إعداد المالك غير مكتمل" }, description: { en: "Complete the CTO security setup before normal operations begin.", ar: "أكمل إعداد أمان المدير التقني قبل بدء العمليات المعتادة." } },
  NORMAL_OPERATIONS_LOCKED: { title: { en: "Normal operations are locked", ar: "العمليات المعتادة مقفلة" }, description: { en: "Resolve the active recovery or platform lock before opening the storefront.", ar: "عالج وضع الاسترداد أو قفل المنصة قبل فتح المتجر." } },
  TAX_POLICY_UNREVIEWED: { title: { en: "Tax treatment needs review", ar: "المعالجة الضريبية تحتاج مراجعة" }, description: { en: "Confirm the owner-reviewed launch tax mode below.", ar: "أكد وضع الضريبة المعتمد من المالك أدناه." } },
  COD_REDELIVERY_POLICY_UNREVIEWED: { title: { en: "COD redelivery policy needs review", ar: "سياسة إعادة توصيل الدفع عند الاستلام تحتاج مراجعة" }, description: { en: "Confirm the reviewed COD redelivery policy below.", ar: "أكد سياسة إعادة توصيل الدفع عند الاستلام المعتمدة أدناه." } },
  BILINGUAL_TERMS_MISSING: { title: { en: "Published bilingual terms are missing", ar: "الشروط المنشورة باللغتين غير مكتملة" }, description: { en: "Publish one immutable English and Arabic terms version below.", ar: "انشر إصداراً ثابتاً من الشروط بالإنجليزية والعربية أدناه." } },
  FULFILLMENT_UNCONFIGURED: { title: { en: "Fulfillment is not configured", ar: "إعداد التنفيذ غير مكتمل" }, description: { en: "Create a reviewed delivery zone or active pickup location on the Delivery & pickup page.", ar: "أنشئ منطقة توصيل معتمدة أو موقع استلام نشطاً في صفحة التوصيل والاستلام." } },
  CTO_RECOVERY_DRILL_NOT_PASSED: { title: { en: "Recovery drill evidence is missing", ar: "دليل تمرين الاسترداد غير موجود" }, description: { en: "Complete the two-key recovery drill and record the immutable result below.", ar: "أكمل تمرين الاسترداد بمفتاحين وسجل النتيجة الثابتة أدناه." } },
  PAYOUT_PROVIDER_SIMULATION_ONLY: { title: { en: "Payouts are in simulation mode", ar: "عمليات السحب في وضع المحاكاة" }, description: { en: "The proof-of-concept workflow is ready, but production payouts remain disabled until the APS beneficiary-disbursement contract and sandbox evidence are verified.", ar: "سير عمل إثبات المفهوم جاهز، لكن عمليات السحب في الإنتاج تظل معطلة حتى يتم التحقق من عقد صرف الأموال للمستفيدين مع APS وأدلة بيئة الاختبار." } },
};
const unknown: BlockerCopy = { title: { en: "A launch requirement needs review", ar: "أحد متطلبات الإطلاق يحتاج مراجعة" }, description: { en: "Review the current release evidence or ask an authorized owner for the next action.", ar: "راجع أدلة الإصدار الحالية أو اطلب الإجراء التالي من مالك مخوّل." } };
export function readinessBlockerCopy(code: string): BlockerCopy { return blockers[code] ?? unknown; }
