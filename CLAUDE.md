# Wardrobe - React Native App

## Project Overview
React Native mobile app for wardrobe management using the latest React Native (0.87.1) with TypeScript support.

## Development Requirements

### Working Environment
- **Repository**: Local repository at `~/Documents/wardrobe`
- **Branch Strategy**: Use `claude/amazing-brown-v99ak2` branch for development
- **Always work on the local repository** - not cloud sessions
- Push changes to GitHub after each feature/fix

### Technology Stack
- React Native 0.87.1 (latest)
- React 19.2.3
- TypeScript
- Android & iOS support
- Metro bundler

### Development Workflow
1. All work should be done on the local repository
2. Test changes locally before pushing
3. Use meaningful commit messages with context
4. Push to `claude/amazing-brown-v99ak2` branch
5. Keep dependencies updated

### Project Structure
```
wardrobe/
├── App.tsx          # Main app component
├── index.js         # Entry point
├── android/         # Android native code
├── ios/             # iOS native code
├── package.json     # Dependencies & scripts
└── tsconfig.json    # TypeScript configuration
```

### Available Scripts
- `npm start` - Start Metro bundler
- `npm run android` - Run on Android emulator
- `npm run ios` - Run on iOS simulator
- `npm run lint` - Run ESLint
- `npm test` - Run Jest tests

### Notes
- No testing/building required during initialization
- Focus on clean code and component structure
- Use TypeScript for type safety
- Keep native code minimal for now
