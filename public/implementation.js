//common function to call the server endpoint in app.js
async function callServer(url, data) {
  const res = await fetch(url, {
    method: "POST",
    body: data ? JSON.stringify(data) : "",
    headers: {
      "Content-Type": "application/json",
    },
  });
  return await res.json();
}

//if action, dropin will handle it. If not depends on result code and redirect
function handleServerResponse(res, component) {
  if (res.action) {
    component.handleAction(res.action);
  } else {
    switch (res.resultCode) {
      case "Authorized":
        window.location.href = "/success";
        break;
      case "Pending":
      case "Received":
        window.location.href = "/pending";
        break;
      case "Refused":
        window.location.href = "/failed";
        break;
      default:
        window.location.href = "/error";
        break;
    }
  }
}

//component is the dropin here
async function handleSubmission(state, component, url) {
  try {
    const res = await callServer(url, state.data);
    handleServerResponse(res, component);
  } catch (error) {
    console.error(error);
  }
}

const clientKey1 = document.getElementById("clientKey").innerHTML;
const paymentMethodsResponse1 = JSON.parse(
  document.getElementById("paymentResponse").innerHTML
);

//config for cards and ideal payment method
const configuration = {
  paymentMethodsResponse: paymentMethodsResponse1,
  clientKey: clientKey1,
  locale: "en_US",
  environment: "test",
  paymentMethodsConfiguration: {
    card: {
      hasHolderName: true,
      holderNameRequired: true,
      enableStoreDetails: true,
      name: "Credit or debit card",
      billingAddressRequired: true,
    },
    ideal: {
      showImage: true,
    },
  },
  onSubmit: (state, component) => {
    handleSubmission(state, component, "/api/initiatePayment");
  },
  onAdditionalDetails: (state, component) => {
    handleSubmission(state, component, "/api/submitAdditionalDetails");
  },
};

const checkout = new AdyenCheckout(configuration);
const integration = checkout
  .create("dropin")
  .mount(document.getElementById("dropin"));
