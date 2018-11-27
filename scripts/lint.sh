echo "Linting files ..."

./node_modules/.bin/eslint src/ tests/ --ext .js --ext .ts $1

# ./node_modules/.bin/eslint demo/ --ext .js --ext .ts $1
