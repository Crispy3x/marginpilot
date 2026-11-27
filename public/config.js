// Public settings for the browser. Nothing secret belongs here.
// Fill these after the Supabase project and Whop plans exist (see README).
window.MP_CONFIG = {
  supabaseUrl: 'https://zsnizrlpmiobeuuaqmko.supabase.co',
  supabaseAnonKey: 'sb_publishable_Dve5QzFwLjhLJ1WSSFxDAQ_raUbYD0o',
  // Whop plan ids (plan_...) for each tier and billing period.
  plans: {
    starter: { monthly: 'plan_STARTER_MONTHLY', yearly: 'plan_STARTER_YEARLY' },
    growth: { monthly: 'plan_GROWTH_MONTHLY', yearly: 'plan_GROWTH_YEARLY' },
    pro: { monthly: 'plan_PRO_MONTHLY', yearly: 'plan_PRO_YEARLY' },
  },
};
