export interface EmailData {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  cc?: string;
  bcc?: string;
  "h-Reply-To"?: string;
  "o:deliverytime"?: string; // 'Thu, 13 Oct 2011 18:02:00 +0000'
  "o:testmode"?: boolean;
}

function urlEncodeObject(obj: { [s: string]: any }) {
  return Object.keys(obj)
    .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(obj[k]))
    .join("&");
}

function sendMail(data: EmailData, env: Bindings) {
  const dataUrlEncoded = urlEncodeObject(data);
  const opts = {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa("api:" + env.MAILGUN_API_KEY),
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": dataUrlEncoded.length.toString(),
    },
    body: dataUrlEncoded,
  };

  return fetch(`${env.MAILGUN_API_BASE_URL}/messages`, opts);
}

async function readRequestBody(request: Request) {
  const { headers } = request;
  const contentType = headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return await request.json();
  } else {
    throw new Error(`Unsupported content type: ${contentType}`);
  }
}

function handleOptions(request: Request) {
  if (
    request.headers.get("Origin") !== null &&
    request.headers.get("Access-Control-Request-Method") !== null &&
    request.headers.get("Access-Control-Request-Headers") !== null
  ) {
    // Handle CORS pre-flight request.
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Client-Key",
      },
    });
  } else {
    // Handle standard OPTIONS request.
    return new Response(null, {
      headers: {
        Allow: "GET, HEAD, POST, OPTIONS",
      },
    });
  }
}

const JSONResponse = (message, status = 200) => {
  let headers = {
    headers: {
      "content-type": "application/json;charset=UTF-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },

    status: status,
  };

  let response = {
    message: message,
  };

  return new Response(JSON.stringify(response), headers);
};

export async function handleRequest(request: Request, env: Bindings) {
  if (request.method === "OPTIONS") {
    return handleOptions(request);
  }

  if (request.method !== "POST") {
    throw new Error("Only POST requests are supported");
  }

  const url = new URL(request.url);
  if (url.pathname !== "/addReminder") {
    throw new Error("Only POST requests to /addReminder are supported");
  }

  const reqBody = await readRequestBody(request);
  const { action, email } = reqBody as any;

  let message: string;
  let sendAt: Date;
  switch (action) {
    case "withdraw":
      message =
        "Hey! Your CELO is waiting withdrawal. Make sure to withdraw it to your account, cheers.";
      // 3 days from now
      sendAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      break;
    case "activate":
      message =
        "Hey! Your CELO is waiting to be activated. You need to activate your stake for it to start earning for you. Make sure to activate your CELO soon, cheers.";
      // 1 day from now
      sendAt = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
      break;
    default:
      throw new Error(`Unsupported action: ${action}`);
      break;
  }

  const emailResponse = await sendMail(
    {
      from: "noreply@churrito.fi",
      to: email,
      subject: "Reminder from ChurritoFi!",
      text: message,
      "o:deliverytime": sendAt.toUTCString(),
    },
    env
  );

  console.log(`Email response: ${emailResponse.status}`);
  if (!emailResponse.ok) {
    throw new Error(`Error sending email: ${emailResponse.statusText}`);
  }

  const responseInit = {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
    status: 201,
  };

  return new Response("Reminder scheduled", responseInit);
}

const worker: ExportedHandler<Bindings> = { fetch: handleRequest };

export default worker;
