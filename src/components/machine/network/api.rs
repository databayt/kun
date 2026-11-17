//! The HTTP edge: one trait, so the loop and the gate are tested against a mock and only
//! `HttpApi` ever touches the network. Every call carries `Authorization: Bearer <machine token>`.

use std::{future::Future, time::Duration};

use serde::de::DeserializeOwned;

/// Where kun's API lives: `KUN_API`, else localhost in a dev build, else production.
#[must_use]
pub fn api_base(env: Option<&str>, debug: bool) -> String {
    match env.map(str::trim).filter(|s| !s.is_empty()) {
        Some(url) => url.trim_end_matches('/').to_owned(),
        None if debug => "http://localhost:3000".to_owned(),
        None => "https://kun.databayt.org".to_owned(),
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("no machine token: ask Abdout for one and paste it in settings")]
    NoToken,
    #[error("kun answered {status}: {body}")]
    Status { status: u16, body: String },
    #[error("could not reach kun: {0}")]
    Transport(String),
    #[error("kun's answer was not understood: {0}")]
    Decode(String),
}

/// A bare JSON transport. Paths start with `/api/machine/`.
pub trait Api: Send + Sync {
    /// # Errors
    /// On a missing token, a non-2xx answer or a network failure.
    fn get(&self, path: &str) -> impl Future<Output = Result<String, ApiError>> + Send;
    /// # Errors
    /// As [`Api::get`].
    fn post(
        &self,
        path: &str,
        body: String,
    ) -> impl Future<Output = Result<String, ApiError>> + Send;
}

/// GET and decode.
///
/// # Errors
/// From the transport, or when the answer does not match `T`.
pub async fn get_json<T: DeserializeOwned>(api: &impl Api, path: &str) -> Result<T, ApiError> {
    let text = api.get(path).await?;
    serde_json::from_str(&text).map_err(|e| ApiError::Decode(e.to_string()))
}

/// POST a serializable body and decode the answer.
///
/// # Errors
/// From the transport, or when the answer does not match `T`.
pub async fn post_json<T: DeserializeOwned>(
    api: &impl Api,
    path: &str,
    body: &impl serde::Serialize,
) -> Result<T, ApiError> {
    let body = serde_json::to_string(body).map_err(|e| ApiError::Decode(e.to_string()))?;
    let text = api.post(path, body).await?;
    serde_json::from_str(&text).map_err(|e| ApiError::Decode(e.to_string()))
}

/// The real transport: reqwest + rustls, the token read from the OS store on every call.
pub struct HttpApi {
    base: String,
    client: reqwest::Client,
}

impl HttpApi {
    /// # Errors
    /// When the HTTP client cannot be built.
    pub fn from_process() -> Result<Self, ApiError> {
        let base = api_base(
            std::env::var("KUN_API").ok().as_deref(),
            cfg!(debug_assertions),
        );
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(20))
            .user_agent(concat!("kun-machine/", env!("CARGO_PKG_VERSION")))
            .build()
            .map_err(|e| ApiError::Transport(e.to_string()))?;
        Ok(Self { base, client })
    }

    async fn send(&self, builder: reqwest::RequestBuilder) -> Result<String, ApiError> {
        let token = super::token::load()
            .map_err(ApiError::Transport)?
            .ok_or(ApiError::NoToken)?;
        let res = builder
            .bearer_auth(token)
            .send()
            .await
            .map_err(|e| ApiError::Transport(e.without_url().to_string()))?;
        let status = res.status();
        let body = res
            .text()
            .await
            .map_err(|e| ApiError::Transport(e.without_url().to_string()))?;
        if status.is_success() {
            Ok(body)
        } else {
            Err(ApiError::Status {
                status: status.as_u16(),
                body: body.chars().take(500).collect(),
            })
        }
    }
}

impl Api for HttpApi {
    async fn get(&self, path: &str) -> Result<String, ApiError> {
        self.send(self.client.get(format!("{}{path}", self.base)))
            .await
    }

    async fn post(&self, path: &str, body: String) -> Result<String, ApiError> {
        let req = self
            .client
            .post(format!("{}{path}", self.base))
            .header(reqwest::header::CONTENT_TYPE, "application/json")
            .body(body);
        self.send(req).await
    }
}
