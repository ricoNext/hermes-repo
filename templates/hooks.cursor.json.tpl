{
  "version": 1,
  "hooks": {
    "sessionStart": [
      {
        "command": "npx __PACKAGE_NAME__ inject"
      }
    ],
    "stop": [
      {
        "command": "npx __PACKAGE_NAME__ capture"
      }
    ]
  }
}
