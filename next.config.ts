import type { NextConfig } from "next";
const apiOrigin=process.env.API_ORIGIN??"https://api.example.com";
const nextConfig:NextConfig={poweredByHeader:false,reactStrictMode:true,async redirects(){return[{source:"/:path*",has:[{type:"host",value:"www.example.com"}],destination:"https://example.com/:path*",permanent:true}];},async rewrites(){return[{source:"/api/:path*",destination:`${apiOrigin}/api/:path*`},{source:"/media/:path*",destination:`${apiOrigin}/media/:path*`}];}};
export default nextConfig;
