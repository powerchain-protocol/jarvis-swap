import { NextRequest, NextResponse } from "next/server";
import { assertCronAuthorized } from "@/services/security/cron";
import { reconcilePendingSwaps } from "@/services/transactions/reconcile";
export const runtime="nodejs"; export const dynamic="force-dynamic";
export async function GET(request:NextRequest){try{assertCronAuthorized(request);const result=await reconcilePendingSwaps(100);return NextResponse.json({ok:true,...result},{headers:{"cache-control":"no-store"}})}catch(cause){const message=cause instanceof Error?cause.message:"Reconciliation failed";return NextResponse.json({ok:false,error:message},{status:message.toLowerCase().includes("unauthorized")?401:500,headers:{"cache-control":"no-store"}})}}
