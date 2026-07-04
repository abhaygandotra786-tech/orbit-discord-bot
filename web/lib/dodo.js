/**
 * Orbit Web - Dodo Payments integration
 * ------------------------------------------------------------------
 * Creates hosted checkout sessions and verifies incoming webhooks.
 * On a successful payment webhook, the caller grants Premium/Pro to the
 * Discord user carried in the checkout `metadata`.
 */

const config = require("../../config/config");

const DODO = config.PREMIUM.DODO;
let client = null;

function isConfigured() {
    return Boolean(DODO.API_KEY);
}

function getClient() {
    if (!isConfigured()) return null;
    if (client) return client;
    const DodoPayments = require("dodopayments");
    const Ctor = DodoPayments.default || DodoPayments;
    client = new Ctor({
        bearerToken: DODO.API_KEY,
        environment: DODO.ENVIRONMENT
    });
    return client;
}

/**
 * Create a hosted checkout session for a tier.
 * @param {{ tier: string, discordId: string, discordName?: string, returnUrl: string }} opts
 * @returns {Promise<string>} the checkout URL to redirect the user to
 */
async function createCheckout({ tier, discordId, discordName, returnUrl }) {
    const productId = DODO.PRODUCTS[tier];
    if (!productId) throw new Error(`No Dodo product configured for tier "${tier}"`);

    const c = getClient();
    if (!c) throw new Error("Dodo Payments is not configured");

    const session = await c.checkoutSessions.create({
        product_cart: [{ product_id: productId, quantity: 1 }],
        return_url: returnUrl,
        metadata: {
            discord_id: String(discordId),
            discord_name: discordName ? String(discordName) : "",
            tier
        }
    });

    return session.checkout_url || session.url;
}

/** Map a Dodo product id back to our tier key. */
function tierFromProduct(productId) {
    if (!productId) return null;
    for (const [tier, pid] of Object.entries(DODO.PRODUCTS)) {
        if (pid && pid === productId) return tier;
    }
    return null;
}

/**
 * Verify a webhook using the Standard Webhooks signature scheme.
 * @param {string} rawBody  the raw request body (string)
 * @param {object} headers  { "webhook-id", "webhook-signature", "webhook-timestamp" }
 * @returns {object} the parsed, verified event payload
 */
function verifyWebhook(rawBody, headers) {
    const { Webhook } = require("standardwebhooks");
    const wh = new Webhook(DODO.WEBHOOK_SECRET);
    return wh.verify(rawBody, headers);
}

module.exports = {
    isConfigured,
    createCheckout,
    tierFromProduct,
    verifyWebhook
};
