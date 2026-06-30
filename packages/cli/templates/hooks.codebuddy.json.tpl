{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx __PACKAGE_NAME__ capture"
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx __PACKAGE_NAME__ inject"
          }
        ]
      }
    ]
  }
}
