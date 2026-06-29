/*
  # Torna forma_pagamento opcional em quote_payments

  ## Motivo
  A constraint NOT NULL em quote_payments.forma_pagamento estava bloqueando
  silenciosamente a criacao do registro de pagamento sempre que o fluxo de
  aprovacao (modal React ou widget do Chatwoot) salvava comprovantes sem
  preencher a forma de pagamento. Isso fazia com que comprovantes de
  pagamento/aprovacao enviados no formulario nunca fossem persistidos.
*/

ALTER TABLE quote_payments ALTER COLUMN forma_pagamento DROP NOT NULL;
