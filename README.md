# Procella 🌍

Uncovering Earth's environmental trends through NASA satellite data, scientific analysis, and
interactive visualisations. Built for the NASA Space Apps Challenge 2026, challenge
**Earth System Trend Detective**.

Pick a variable and a place. Procella plots how it has changed, then tells you what is changing,
where, how much, and whether the change is statistically significant.

## Team

Daksh Dayalani and Priyanshu Naskar.

## Documentation

- [Challenge brief](docs/challenge-brief.md): what we were asked to build, in plain English
- [Resources](docs/resources.md): every official resource and whether we use it
- [Data access notes](docs/data-access-notes.md): verified facts about NASA POWER and MODIS access
- [Strategy](docs/strategy.md): the debate, the five ranked ideas and the build order
- [Build journal](build%20journal.md): every fix and dead end, in order

## Getting started

```bash
git clone https://github.com/itzblaze-10/Procella.git
cd Procella
./scripts/install-hooks.sh   # auto-push after every commit
./scripts/sync-check.sh      # confirms local and GitHub are identical
```

The core product needs no credentials. Copy `.env.example` to `.env` only if optional sources are added.

## Status

Planning and scaffolding complete. Application code starts after the partners confirm the
decisions listed at the bottom of [docs/strategy.md](docs/strategy.md).

## Data

NASA POWER (MERRA-2 and CERES derived) and ORNL DAAC MODIS services. Both are open.
POWER values are model-derived, not direct observations, and the app says so.
