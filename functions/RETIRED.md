# Retired

This Cloud Functions package is not part of the doctor portal runtime.

Clinical data, auth, and teleconsult tokens live on the Django API (`anixi-backend`). Firebase remains only for FCM push, configured on the API — not by deploying this folder.

Do not run `firebase deploy` from `anixi-portal`.
