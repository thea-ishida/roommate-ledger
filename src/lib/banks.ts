/**
 * Interac e-Transfer has no public "send money" deep link: transfers can only
 * be started from inside your own bank's app or website. So we open the bank's
 * sign-in page and hand over the recipient, amount and memo to paste.
 *
 * URLs checked October 2026. Banks move these around, so keep them here only.
 */
export interface Bank {
  id: string;
  name: string;
  loginUrl: string;
}

export const BANKS: Bank[] = [
  { id: "rbc", name: "RBC Royal Bank", loginUrl: "https://secure.royalbank.com/statics/login-service-ui/index" },
  { id: "td", name: "TD", loginUrl: "https://easyweb.td.com/" },
  { id: "scotia", name: "Scotiabank", loginUrl: "https://auth.scotiaonline.scotiabank.com/online" },
  { id: "bmo", name: "BMO", loginUrl: "https://www1.bmo.com/banking/digital/login" },
  { id: "cibc", name: "CIBC", loginUrl: "https://www.cibconline.cibc.com/ebm-resources/online-banking/client/index.html" },
  { id: "nbc", name: "National Bank", loginUrl: "https://app.bnc.ca/" },
  { id: "desjardins", name: "Desjardins", loginUrl: "https://accweb.mouv.desjardins.com/identifiantunique/authentification" },
  { id: "tangerine", name: "Tangerine", loginUrl: "https://www.tangerine.ca/app/" },
  { id: "simplii", name: "Simplii Financial", loginUrl: "https://online.simplii.com/ebm-resources/public/client/web/index.html" },
  { id: "pc", name: "PC Financial", loginUrl: "https://secure.pcfinancial.ca/en/login" },
  { id: "eq", name: "EQ Bank", loginUrl: "https://secure.eqbank.ca/login" },
  { id: "wealthsimple", name: "Wealthsimple", loginUrl: "https://my.wealthsimple.com/app/login" },
  { id: "atb", name: "ATB Financial", loginUrl: "https://personal.atb.com/" },
];
