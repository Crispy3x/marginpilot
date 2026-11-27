// Public settings for the browser. Nothing secret belongs here.
// Fill these after the Supabase project and Whop plans exist (see README).
window.MP_CONFIG = {
  supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR-SUPABASE-ANON-KEY',
  // Whop plan ids (plan_...) for each tier and billing period.
  plans: {
    starter: { monthly: 'plan_STARTER_MONTHLY', yearly: 'plan_STARTER_YEARLY' },
    growth: { monthly: 'plan_GROWTH_MONTHLY', yearly: 'plan_GROWTH_YEARLY' },
    pro: { monthly: 'plan_PRO_MONTHLY', yearly: 'plan_PRO_YEARLY' },
  },
};
