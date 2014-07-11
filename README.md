Udaman
====

Setting up your development environment
----

Run the following from the terminal in the folder you want your clone of the repo:

```
$ git clone https://github.com/UHERO/udaman.git
$ cd udaman
$ bundle install
```

Configure the remote (you can rename `upstream`):
```
$ git remote add upstream https://github.com/UHERO/udaman.git
```

To fetch changes to the repository that are not in your local tree:
```
$ git fetch upstream
$ git merge upstream/master
```

To push changes to the repository:
```
$ git push upstream master
```

To deploy the changes to the production server:
1) SSH into the production server
2) cd to the udaman folder
3) fetch changes
```
$ git fetch origin master
$ git merge origin/master
```
4) Resolve any conflicts and commit the changes.

To check the names and locations of remote:
```
$ git remote -v
```
