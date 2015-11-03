#/bin/sh
git checkout gh-pages
git rebase master
git push origin gh-pages
git checkout master