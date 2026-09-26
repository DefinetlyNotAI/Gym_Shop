# Gym Shop Storefront

Customer storefront and account interface. It communicates with the API over versioned HTTP endpoints and defaults to Arabic. Run `npm install`, then `npm run dev`.

Local port: `3030`.

v0.2 adds promotion-aware checkout, rewards and wallet tender, referrals, review authoring, partner verification, explicitly provider-gated wallet payouts, newsletter consent, and exact-variant restock alerts. Amazon Payment Services is displayed as the selected integration. Payout request controls remain disabled while the API reports unverified APS beneficiary-disbursement capability; card refund support does not activate wallet withdrawals.
