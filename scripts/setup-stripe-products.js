#!/usr/bin/env node
/**
 * Stripe Product Setup Script for Sentinel Prime New Business Model
 * 
 * This script creates the new Stripe products and prices for the updated business model.
 * Run with: node scripts/setup-stripe-products.js
 * 
 * Prerequisites:
 * - Set STRIPE_SECRET_KEY environment variable
 * - Stripe account with proper permissions
 */

require('dotenv').config();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error('Error: STRIPE_SECRET_KEY environment variable is required');
  console.error('Set it with: export STRIPE_SECRET_KEY=sk_test_... or sk_live_...');
  process.exit(1);
}

const stripe = require('stripe')(STRIPE_SECRET_KEY);

// Configuration for new business model products
const PRODUCTS = {
  // Subscription Products
  sentinelInvest: {
    name: 'Sentinel Invest',
    description: 'AI-powered trading signals and strategy breakdowns with paper and live execution via Alpaca',
    prices: [
      { nickname: 'Invest Monthly', unitAmount: 999, interval: 'month', intervalCount: 1 }
    ]
  },
  sentinelPlus: {
    name: 'Sentinel Plus',
    description: 'Complete bundle: Sentinel Shield, Sentinel Care, Sentinel Command, Sentinel Scout, and Sentinel Invest included',
    prices: [
      { nickname: 'Plus Monthly', unitAmount: 1999, interval: 'month', intervalCount: 1 },
      { nickname: 'Plus Annual', unitAmount: 14900, interval: 'year', intervalCount: 1 }
    ]
  },
  // One-time Care Add-on Products
  careRemoteMember: {
    name: 'Sentinel Care - Remote Desktop Support (Member)',
    description: 'Remote desktop support session for Sentinel Plus members. First session every 6 months is free.',
    prices: [{ nickname: 'Member Remote Hour', unitAmount: 4000, type: 'one_time' }]
  },
  careRemoteNonMember: {
    name: 'Sentinel Care - Remote Desktop Support (Non-Member)',
    description: 'Remote desktop support session for non-members',
    prices: [{ nickname: 'Non-Member Remote Hour', unitAmount: 10000, type: 'one_time' }]
  },
  carePhoneNonMember: {
    name: 'Sentinel Care - Phone Support (Non-Member)',
    description: 'Phone support call for non-members',
    prices: [{ nickname: 'Non-Member Phone Call', unitAmount: 1000, type: 'one_time' }]
  }
};

async function createProduct(productKey, config) {
  console.log(`\n📦 Creating product: ${config.name}`);
  
  try {
    // Create the product
    const product = await stripe.products.create({
      name: config.name,
      description: config.description,
      metadata: {
        key: productKey,
        created_by: 'setup-script',
        created_at: new Date().toISOString()
      }
    });
    
    console.log(`   ✅ Product created: ${product.id}`);
    
    // Create prices for this product
    const priceIds = [];
    for (const priceConfig of config.prices) {
      const priceData = {
        product: product.id,
        nickname: priceConfig.nickname,
        unit_amount: priceConfig.unitAmount,
        currency: 'usd',
        metadata: {
          product_key: productKey,
          plan_nickname: priceConfig.nickname
        }
      };
      
      // Add recurring data for subscriptions
      if (priceConfig.type !== 'one_time') {
        priceData.recurring = {
          interval: priceConfig.interval,
          interval_count: priceConfig.intervalCount
        };
      }
      
      const price = await stripe.prices.create(priceData);
      priceIds.push({ nickname: priceConfig.nickname, id: price.id, amount: priceConfig.unitAmount });
      console.log(`   💰 Price created: ${price.id} (${priceConfig.nickname} - $${priceConfig.unitAmount / 100})`);
    }
    
    return { product, priceIds };
  } catch (error) {
    console.error(`   ❌ Error creating product ${config.name}:`, error.message);
    throw error;
  }
}

async function archiveOldProducts() {
  console.log('\n📋 OLD PRODUCTS TO ARCHIVE (MANUAL STEP REQUIRED)');
  console.log('=' .repeat(60));
  console.log('The following old products should be archived in Stripe Dashboard:');
  console.log('  1. SentinelAI Monthly ($14.99/mo)');
  console.log('  2. SentinelAI Annual ($99/yr)');
  console.log('  3. SentinelAI Lifetime ($499 one-time)');
  console.log('');
  console.log('⚠️  IMPORTANT: Do NOT delete these products - archive them instead.');
  console.log('   Archiving preserves existing customer data and subscriptions.');
  console.log('   In Stripe Dashboard: Products → [Product] → Archive');
  console.log('=' .repeat(60));
}

async function main() {
  console.log('🚀 Sentinel Prime Stripe Product Setup');
  console.log('=' .repeat(60));
  console.log(`Mode: ${STRIPE_SECRET_KEY.startsWith('sk_test_') ? 'TEST' : 'LIVE'}`);
  console.log('=' .repeat(60));
  
  const results = {};
  
  // Archive notice
  await archiveOldProducts();
  
  console.log('\n🆕 CREATING NEW PRODUCTS');
  console.log('=' .repeat(60));
  
  try {
    // Create Sentinel Invest
    results.invest = await createProduct('sentinelInvest', PRODUCTS.sentinelInvest);
    
    // Create Sentinel Plus
    results.plus = await createProduct('sentinelPlus', PRODUCTS.sentinelPlus);
    
    // Create Care add-ons
    results.careRemoteMember = await createProduct('careRemoteMember', PRODUCTS.careRemoteMember);
    results.careRemoteNonMember = await createProduct('careRemoteNonMember', PRODUCTS.careRemoteNonMember);
    results.carePhoneNonMember = await createProduct('carePhoneNonMember', PRODUCTS.carePhoneNonMember);
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ ALL PRODUCTS CREATED SUCCESSFULLY');
    console.log('=' .repeat(60));
    
    // Output summary for environment variables
    console.log('\n📋 ENVIRONMENT VARIABLES TO SET:');
    console.log('-'.repeat(60));
    console.log('# Subscription Products');
    console.log(`STRIPE_PRICE_INVEST_MONTHLY=${results.invest.priceIds.find(p => p.nickname === 'Invest Monthly').id}`);
    console.log(`STRIPE_PRICE_PLUS_MONTHLY=${results.plus.priceIds.find(p => p.nickname === 'Plus Monthly').id}`);
    console.log(`STRIPE_PRICE_PLUS_ANNUAL=${results.plus.priceIds.find(p => p.nickname === 'Plus Annual').id}`);
    console.log('');
    console.log('# Care One-time Add-ons');
    console.log(`STRIPE_PRICE_CARE_REMOTE_MEMBER=${results.careRemoteMember.priceIds[0].id}`);
    console.log(`STRIPE_PRICE_CARE_REMOTE_NONMEMBER=${results.careRemoteNonMember.priceIds[0].id}`);
    console.log(`STRIPE_PRICE_CARE_PHONE_NONMEMBER=${results.carePhoneNonMember.priceIds[0].id}`);
    console.log('-'.repeat(60));
    
    console.log('\n💾 Save these to your Netlify environment variables!');
    console.log('   Netlify Dashboard: Site settings → Environment variables');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, PRODUCTS };
