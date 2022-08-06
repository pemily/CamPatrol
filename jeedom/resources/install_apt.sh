#!/bin/bash

PROGRESS_FILE=/tmp/jeedom/camPatrouille/dependency

if [ ! -z $1]
then 
    PROGRESS_FILE=$1
fi

touch ${PROGRESS_FILE} 
echo 0 > ${PROGRESS_FILE} 
echo “************”
echo “ Launch install of dependencies ” 
echo “************”
# echo $(date)
echo 5 > ${PROGRESS_FILE}
sleep 5
# apt-get clean
echo 10 > ${PROGRESS_FILE}
sleep 5
# apt-get update
echo 20 > ${PROGRESS_FILE}
sleep 5
echo “**********”
echo “Install modules using apt-get”
echo “**********” 
echo 60 > ${PROGRESS_FILE}
sleep 5
echo “************”
echo “Install the required python libraries” 
echo “************”
sleep 5
echo 100 > ${PROGRESS_FILE}
# echo $(date)
echo “********”
echo “ Install ended ”
echo “********”
rm ${PROGRESS_FILE}

