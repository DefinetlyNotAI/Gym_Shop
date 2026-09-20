export type OperationsRoute = {
  id: string;
  href: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  group:
    | "Workspace"
    | "Commerce"
    | "Growth"
    | "Trust & finance"
    | "Administration";
  roles: readonly string[];
  requests: readonly string[];
};

const management = ["CTO", "SUPER_ADMIN", "ADMIN"];
const logistics = [...management, "LOGISTICS_STAFF"];
const support = [...management, "SUPPORT_AGENT"];
const finance = ["CTO", "SUPER_ADMIN", "FINANCE_STAFF"];
const staff = [
  ...management,
  "LOGISTICS_STAFF",
  "SUPPORT_AGENT",
  "FINANCE_STAFF",
];

export const operationsRoutes: readonly OperationsRoute[] = [
  {
    id: "overview",
    href: "/",
    title: "Overview",
    titleAr: "نظرة عامة",
    description: "Your daily operations, at a glance.",
    descriptionAr: "عملياتك اليومية في لمحة واحدة.",
    group: "Workspace",
    roles: staff,
    requests: [],
  },
  {
    id: "analytics",
    href: "/analytics",
    title: "Analytics",
    titleAr: "التحليلات",
    description:
      "Role-scoped measures with clear definitions and reconciled totals.",
    descriptionAr: "مؤشرات حسب الصلاحيات بتعريفات واضحة وإجماليات مطابقة.",
    group: "Workspace",
    roles: staff,
    requests: ["/api/v1/admin/analytics"],
  },
  {
    id: "orders",
    href: "/orders",
    title: "Orders",
    titleAr: "الطلبات",
    description:
      "Pack, dispatch, and complete orders with a clear fulfillment trail.",
    descriptionAr: "تجهيز الطلبات وإرسالها وإكمالها بسجل تنفيذ واضح.",
    group: "Commerce",
    roles: logistics,
    requests: ["/api/v1/admin/orders", "/api/v1/platform"],
  },
  {
    id: "catalog",
    href: "/catalog",
    title: "Products",
    titleAr: "المنتجات",
    description:
      "Manage product names, prices, visibility, and featured selections.",
    descriptionAr: "إدارة أسماء المنتجات وأسعارها وظهورها والاختيارات المميزة.",
    group: "Commerce",
    roles: logistics,
    requests: ["/api/v1/admin/catalog/products"],
  },
  {
    id: "inventory",
    href: "/inventory",
    title: "Inventory",
    titleAr: "المخزون",
    description: "Track availability and record accountable stock movements.",
    descriptionAr: "متابعة التوفر وتسجيل حركات المخزون الموثقة.",
    group: "Commerce",
    roles: logistics,
    requests: ["/api/v1/admin/inventory"],
  },
  {
    id: "categories",
    href: "/categories",
    title: "Categories",
    titleAr: "الفئات",
    description: "Organize products into clear, bilingual categories.",
    descriptionAr: "تنظيم المنتجات في فئات واضحة باللغتين.",
    group: "Commerce",
    roles: logistics,
    requests: ["/api/v1/admin/catalog/products"],
  },
  {
    id: "collections",
    href: "/collections",
    title: "Collections",
    titleAr: "المجموعات",
    description: "Curated collections with their own customer-facing pages.",
    descriptionAr: "مجموعات منتقاة بصفحات خاصة للعملاء.",
    group: "Commerce",
    roles: logistics,
    requests: ["/api/v1/admin/catalog/products"],
  },
  {
    id: "size-guides",
    href: "/size-guides",
    title: "Size guides",
    titleAr: "أدلة المقاسات",
    description: "Named measurements and units, assigned directly to products.",
    descriptionAr: "قياسات ووحدات مسماة مرتبطة بالمنتجات مباشرة.",
    group: "Commerce",
    roles: logistics,
    requests: ["/api/v1/admin/catalog/products"],
  },
  {
    id: "customers",
    href: "/customers",
    title: "Customers",
    titleAr: "العملاء",
    description:
      "Customer activity and service context, limited to your permissions.",
    descriptionAr: "نشاط العملاء وسياق الخدمة ضمن صلاحياتك.",
    group: "Commerce",
    roles: [...logistics, "SUPPORT_AGENT"],
    requests: ["/api/v1/admin/customers"],
  },
  {
    id: "support",
    href: "/support",
    title: "Support",
    titleAr: "الدعم",
    description:
      "Prioritize customer conversations and keep private staff notes separate.",
    descriptionAr: "ترتيب محادثات العملاء وفصل ملاحظات الموظفين الخاصة.",
    group: "Commerce",
    roles: support,
    requests: ["/api/v1/admin/support/tickets"],
  },
  {
    id: "delivery-settings",
    href: "/delivery-settings",
    title: "Delivery & pickup",
    titleAr: "التوصيل والاستلام",
    description: "Reviewed delivery fees, service windows, and pickup locations.",
    descriptionAr: "رسوم التوصيل ونوافذ الخدمة ومواقع الاستلام المعتمدة.",
    group: "Commerce",
    roles: logistics,
    requests: [
      "/api/v1/admin/delivery/zones",
      "/api/v1/admin/delivery/pickups",
    ],
  },
  {
    id: "promotions",
    href: "/promotions",
    title: "Promotions",
    titleAr: "العروض",
    description: "Sales, coupons, and authoritative pricing previews.",
    descriptionAr: "التخفيضات والقسائم ومعاينات التسعير المعتمدة.",
    group: "Growth",
    roles: management,
    requests: ["/api/v1/admin/promotions"],
  },
  {
    id: "campaigns",
    href: "/campaigns",
    title: "Campaigns",
    titleAr: "الحملات",
    description:
      "Newsletter delivery that respects current consent at every attempt.",
    descriptionAr: "إرسال النشرات مع احترام الموافقة الحالية في كل محاولة.",
    group: "Growth",
    roles: management,
    requests: ["/api/v1/admin/notifications/campaigns"],
  },
  {
    id: "referrals",
    href: "/referrals",
    title: "Referrals",
    titleAr: "الإحالات",
    description: "Review referral codes, rewards, and recovery flags.",
    descriptionAr: "مراجعة رموز الإحالة والمكافآت وعلامات الاسترداد.",
    group: "Growth",
    roles: management,
    requests: ["/api/v1/admin/referrals"],
  },
  {
    id: "reviews",
    href: "/reviews",
    title: "Reviews",
    titleAr: "المراجعات",
    description: "Independent moderation without rewriting customer content.",
    descriptionAr: "مراجعة مستقلة دون إعادة كتابة محتوى العملاء.",
    group: "Growth",
    roles: support,
    requests: ["/api/v1/admin/reviews"],
  },
  {
    id: "verification",
    href: "/verification",
    title: "Partner verification",
    titleAr: "توثيق الشركاء",
    description:
      "Review partner applications and identity evidence independently.",
    descriptionAr: "مراجعة طلبات الشركاء وأدلة الهوية بشكل مستقل.",
    group: "Trust & finance",
    roles: management,
    requests: ["/api/v1/admin/verification"],
  },
  {
    id: "payouts",
    href: "/payouts",
    title: "Wallet payouts",
    titleAr: "سحب المحفظة",
    description: "Provider status, payout obligations, and reconciliation.",
    descriptionAr: "حالة مزود الدفع والتزامات السحب والمطابقة.",
    group: "Trust & finance",
    roles: finance,
    requests: ["/api/v1/admin/finance/payouts"],
  },
  {
    id: "finance",
    href: "/finance",
    title: "Finance",
    titleAr: "المالية",
    description:
      "Refund obligations and cash custody, kept distinct and auditable.",
    descriptionAr: "التزامات الاسترداد وعهدة النقد منفصلة وقابلة للتدقيق.",
    group: "Trust & finance",
    roles: finance,
    requests: ["/api/v1/admin/finance/overview"],
  },
  {
    id: "notifications",
    href: "/notifications",
    title: "Message templates",
    titleAr: "قوالب الرسائل",
    description:
      "Versioned bilingual notification templates and delivery channels.",
    descriptionAr: "قوالب الإشعارات ثنائية اللغة بإصدارات وقنوات إرسال واضحة.",
    group: "Administration",
    roles: management,
    requests: ["/api/v1/admin/notifications/templates"],
  },
  {
    id: "audits",
    href: "/audits",
    title: "Audit trail",
    titleAr: "سجل التدقيق",
    description: "Permission-filtered history of operational decisions.",
    descriptionAr: "سجل قرارات العمليات المصفى حسب الصلاحيات.",
    group: "Administration",
    roles: staff,
    requests: ["/api/v1/admin/audits"],
  },
  {
    id: "staff",
    href: "/staff",
    title: "Staff",
    titleAr: "الموظفون",
    description: "Staff lifecycle and one-use security-key enrollment.",
    descriptionAr: "إدارة الموظفين والتسجيل بمفتاح أمان ورمز أحادي الاستخدام.",
    group: "Administration",
    roles: ["CTO", "SUPER_ADMIN"],
    requests: ["/api/v1/admin/staff"],
  },
  {
    id: "settings",
    href: "/settings",
    title: "Launch settings",
    titleAr: "إعدادات التشغيل",
    description:
      "Owner-reviewed launch gates, immutable terms, and readiness evidence.",
    descriptionAr:
      "بوابات الإطلاق والشروط الثابتة وأدلة الجاهزية المعتمدة من المالك.",
    group: "Administration",
    roles: ["CTO"],
    requests: ["/api/v1/health", "/api/v1/admin/readiness"],
  },
];

export function getOperationsRoute(id: string) {
  return operationsRoutes.find((route) => route.id === id);
}

export function routesForRole(role: string) {
  return operationsRoutes.filter((route) => route.roles.includes(role));
}

export function operationsRequests(section: string, role: string): string[] {
  const route = getOperationsRoute(section);
  if (!route?.roles.includes(role)) return [];
  if (section !== "overview") return [...route.requests];
  const requests: string[] = [];
  if (logistics.includes(role))
    requests.push("/api/v1/admin/orders", "/api/v1/admin/inventory");
  if (support.includes(role)) requests.push("/api/v1/admin/support/tickets");
  if (finance.includes(role)) requests.push("/api/v1/admin/finance/overview");
  return requests;
}
