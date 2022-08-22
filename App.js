const express = require("express");
const axios = require("axios");
const path = require("path");
const hbs = require("express-handlebars");
require("dotenv").config();

const API_KEY = process.env.ADYEN_API_KEY;
const MERCHANT_ACCOUNT = process.env.ADYEN_MERCHANT_ACCOUNT;
const CLIENT_KEY = process.env.ADYEN_CLIENT_KEY;

const AxiosOptions = {
  headers: {
    "Content-Type": "application/json",
    "x-api-key": API_KEY,
  },
};

const app = express();

// For JSON objects
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "/public")));

// Use Handlebars as the view engine
app.set("view engine", "handlebars");

app.engine(
  "handlebars",
  hbs.engine({
    defaultLayout: "main",
    layoutsDir: __dirname + "/views/layouts",
  })
);
/* ################# API ENDPOINTS ###################### */

//GETTING PAYMENT METHODS
app.get("/checkout", async (req, res) => {
  try {
    axios
      .post(
        "https://checkout-test.adyen.com/v69/paymentMethods",
        {
          channel: "Web",
          merchantAccount: MERCHANT_ACCOUNT,
          countryCode: "NL",
          amount: { currency: "EUR", value: 57900 },
        },
        AxiosOptions
      )
      .then((response) => {
        res.render("payment", {
          clientKey: CLIENT_KEY,
          response: JSON.stringify(response.data),
        });
      });
  } catch (err) {
    console.error(`Error: ${err.message}, error code: ${err.errorCode}`);
    res.redirect("/error");
  }
});

//INITIATING PAYMENT
const paymentDataStore = {};
app.post("/api/initiatePayment", async (req, res) => {
  try {
    const orderRef = "Filimon_checkoutChallenge";
    const data = {
      amount: { currency: "EUR", value: 57900 },
      reference: orderRef, // required
      merchantAccount: MERCHANT_ACCOUNT, // required
      channel: "Web", // required
      additionalData: {
        allow3DS2: true,
      },
      returnUrl: `http://localhost:8080/api/handleShopperRedirect?orderRef=${orderRef}`, // required for redirect flow
      browserInfo: req.body.browserInfo,
      paymentMethod: req.body.paymentMethod, // required
    };
    //call the payment api url
    axios
      .post("https://checkout-test.adyen.com/v69/payments", data, AxiosOptions)
      .then((response) => {
        const { action } = JSON.parse(JSON.stringify(response.data));
        //if there is additional action,get the orderRef from the response's payment data
        if (action) {
          paymentDataStore[orderRef] = action.paymentData;
        }
        res.json(JSON.parse(JSON.stringify(response.data)));
      });
  } catch (err) {
    console.error(`Error: ${err.message}, error code: ${err.errorCode}`);
    res.redirect("/error");
  }
});

//REDIRECTING SHOPPER
app.all("/api/handleShopperRedirect", async (req, res) => {
  // Create the payload for submitting payment details
  const orderRef = req.query.orderRef;
  const redirect = req.method === "GET" ? req.query : req.body;
  const details = {};
  if (redirect.redirectResult) {
    details.redirectResult = redirect.redirectResult;
  } else {
    details.MD = redirect.MD;
    details.PaRes = redirect.PaRes;
  }
  const payload = {
    details,
    paymentData: paymentDataStore[orderRef],
  };
  try {
    axios
      .post(
        "https://checkout-test.adyen.com/v69/payments/details",
        payload,
        AxiosOptions
      )
      .then((response) => {
        const redirectionPage = JSON.parse(
          JSON.stringify(response.data.resultCode)
        );
        switch (redirectionPage) {
          case "Authorised":
            res.redirect("/success");
            break;
          case "Pending":
          case "Received":
            res.redirect("/pending");
            break;
          case "Refused":
            res.redirect("/failed");
            break;
          default:
            res.redirect("/error");
            break;
        }
      });
  } catch (err) {
    console.error(`Error: ${err.message}, error code: ${err.errorCode}`);
    res.redirect("/error");
  }
});

//SUBMITTING ADDITIONAL DETAILS
app.post("/api/submitAdditionalDetails", async (req, res) => {
  // Create the payload for submitting payment details
  const payload = {
    details: req.body.details,
    paymentData: req.body.paymentData,
  };
  try {
    // Return the response back to client (for further action handling or presenting result to shopper)
    axios
      .post(
        "https://checkout-test.adyen.com/v69/payments/details",
        payload,
        AxiosOptions
      )
      .then((response) => {
        let resultCode = JSON.parse(JSON.stringify(response.data.resultCode));
        let action = JSON.parse(JSON.stringify(response.data)) || null;
        res.json({ action, resultCode });
      });
  } catch (err) {
    console.error(`Error: ${err.message}, error code: ${err.errorCode}`);
    res.status(err.statusCode).json(err.message);
  }
});

/* ################# CLIENT SIDE ENDPOINTS ###################### */

//the homepage
app.get("/", (req, res) => {
  res.render("storePage");
});

app.get("/success", (req, res) => {
  res.render("success");
});

app.get("/pending", (req, res) => {
  res.render("pending");
});

app.get("/failed", (req, res) => {
  res.render("failed");
});

app.get("/error", (req, res) => {
  res.render("error");
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

module.exports = app;
