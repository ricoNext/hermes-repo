{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx __PACKAGE_NAME__ capture"
          },
          {
            "type": "command",
            "command": "npx __PACKAGE_NAME__ flush --if-needed"
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
