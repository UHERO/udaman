# Mailers

Module to combine sms, email, and slack integrations to allow app to send notifications over various channels. Like below, or something similar.

```js
await notify({ user, method: "sms", text: "hello" });
await notify({ user, method: "email", template: "upload-success" });
```
