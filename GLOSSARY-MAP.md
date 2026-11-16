# Glossary Map

Energetica's domain vocabulary is split by context. Each context has its own `GLOSSARY.md` next to the package that owns it, so overloaded words (such as three different things that all sound like "saving") have one meaning per context.

## Contexts

- [Run modes](./backend/src/energetica/GLOSSARY.md): the kinds of Run, and what each is called in code and in prose
- [Persistence & Replay](./backend/src/energetica/freeplay/GLOSSARY.md): how the persistent world saves its state and rebuilds it when the server restarts
- [Accounts & users](./backend/src/energetica/identity/GLOSSARY.md): the server, its accounts, its runs and instances, and the lobby that ties them together
- [Workshop Mode](./backend/src/energetica/workshop/GLOSSARY.md): the moderated, Round-based Run mode for a live session

## Relationships

- **Run modes → Accounts & users**: every **Run** has a mode, fixed when the Run is created. The Run itself, and who may join it, belong to Accounts & users.
- **Run modes → Persistence & Replay**: the persistent world's state is saved and replayed as Persistence & Replay describes. A Workshop session is saved on its own terms.
- **Run modes → Workshop Mode**: Workshop is a Run mode. Its game terms live in Workshop Mode.
- **Persistence & Replay → Accounts & users, Workshop Mode**: **Migration** and **State version** are defined in Persistence & Replay but apply beyond the persistent world. A schema migration upgrades `lobby.db`, and a state migration upgrades a Workshop session.
- **Accounts & users → Workshop Mode**: the **Facilitator** role is defined in Accounts & users, and Workshop Mode pins what a facilitator does at the console. A **Temporary account** exists for one workshop, and a **Team** groups accounts in a Workshop Run.
