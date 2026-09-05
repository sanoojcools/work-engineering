# Freeze an idea so you can reopen it

From this repo:

```
git checkout main
git tag idea-v8
git push origin idea-v8

git checkout idea/v9
git tag idea-v9
git push origin idea-v9
```

Show old demo:

```
git switch idea-v8
docker compose up --build
```
