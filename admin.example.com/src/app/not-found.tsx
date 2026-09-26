import Link from "next/link";import{LocalizedText as T}from"@/components/language-provider";

export default function NotFound(){
  return <main className="page"><h1><T en="Not found" ar="الصفحة غير موجودة"/></h1><Link href="/"><T en="Return to staff operations" ar="العودة إلى عمليات الموظفين"/></Link></main>;
}
