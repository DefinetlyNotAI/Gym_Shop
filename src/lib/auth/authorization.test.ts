import{describe,expect,it}from"vitest";
import{requireCustomer,requireCustomerPortal}from"./authorization";
import type{CurrentAccount}from"./session";

function account(overrides:Partial<CurrentAccount>={}):CurrentAccount{return{id:"id",publicId:"usr_test",email:"buyer@example.com",displayName:"Buyer",status:"ACTIVE",emailVerified:true,phoneVerified:true,role:"CUSTOMER",sessionId:"session",authenticatedAt:new Date(),sessionKind:"NORMAL",...overrides};}

describe("customer authorization boundaries",()=>{
  it("does not let a staff session enter customer APIs",()=>{expect(()=>requireCustomer(account({role:"CTO"}))).toThrow("CUSTOMER_ROLE_REQUIRED");});
  it("restricts commerce while preserving the support/export portal",()=>{const suspended=account({status:"SUSPENDED"});expect(()=>requireCustomer(suspended)).toThrow("ACCOUNT_RESTRICTED");expect(requireCustomerPortal(suspended)).toBe(suspended);});
  it("rejects emergency and disabled sessions from the restricted portal",()=>{expect(()=>requireCustomerPortal(account({sessionKind:"EMERGENCY"}))).toThrow("EMERGENCY_SESSION_RESTRICTED");expect(()=>requireCustomerPortal(account({status:"DISABLED"}))).toThrow("ACCOUNT_INACTIVE");});
});
