# UBC STAT & DSCI Course Mapper

Interactive map of UBC STAT and DSCI courses built with [D3.js](https://d3js.org). See course information on the [UBC Course Calendar](http://www.calendar.ubc.ca/vancouver/courses.cfm).

This course mapper was created by [Siddarth Chilukuri](https://github.com/siddiskid), Kevin Lin, and Brian Kim, based on the original course map by [Patrick Walls](https://patrickwalls.github.io/), [Karen Zhou](https://github.com/zzzzzyzzzzz), and [Wuyang Li](https://github.com/LeoLee5566).

---

<a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/"><img alt="Creative Commons Licence" style="border-width:0" src="https://i.creativecommons.org/l/by-nc-sa/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/">Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License</a>.

---

# Course Mapper Dev Mode Introduction and Features
Siddarth created a 'dev mode' for the course mapper which allows you to make changes to existing courses or even create new ones for the map.

Go to the editor located at https://ubc-stat-it.github.io/course-mapper/dev.html

On the editor page you'll see a copy of the current Course Mapper, with the editor you can make changes to nodes, delete nodes, create nodes, or move them to a desired position.

To start editing, click the 'Dev Tools' icon on the bottom right:  
<img width="470" height="424" alt="image" src="https://github.com/user-attachments/assets/93fbd23c-eadb-4aff-8f3a-e1ef46d507d8" />

A menu will popup with several options, here are them explained:

- The dataset menu lets you choose between Stats and Data Science course maps with a dropdown
<img width="457" height="81" alt="image" src="https://github.com/user-attachments/assets/a5d7bb50-1477-4b4b-9819-a55d15a8bf72" />

- 'Reload Base File' button discards all your changes and resets the course map to the original
<img width="205" height="73" alt="image" src="https://github.com/user-attachments/assets/42ed86d4-6763-4b21-b884-2cc536b7983f" />

- 'Download JSON' lets you download all the changes you have made to a 'JSON file', give this to the IT admin who will use the file to update the course mapper. 'Import JSON' lets you upload the JSON file to see the changes you've made (you'll rarely need this).
<img width="439" height="198" alt="image" src="https://github.com/user-attachments/assets/5f6796c7-44d9-49ea-9dbb-d2edcfceb5dc" />

- 'Map helpers' provide extra functionality, noteably allows you to move nodes around the map by checking 'Enable drag to move nodes'
<img width="459" height="248" alt="image" src="https://github.com/user-attachments/assets/40c825b7-17f1-42da-b5cc-46a25a3b841c" />

- 'Subject Colors' changes the colors of each node. Do no change these unless approved.
<img width="456" height="370" alt="image" src="https://github.com/user-attachments/assets/20ec39ed-6ad1-4dd1-9b21-15ec39910ddd" />

- 'Course Details' lets you change all the information related to a course node. To load a course to make updates, go to the bottom of the menu and choose the correct course under 'Load existing course'.
<img width="429" height="98" alt="image" src="https://github.com/user-attachments/assets/075190f9-25fa-4182-a932-d08c1cadb97a" />

If you want to create a new course, fill out the details and click 'Place on map'

# Workflow for making changes to the publically hosted Course Mapper
1. Go to the editor at https://ubc-stat-it.github.io/course-mapper/dev.html
   
2. Make the necessary changes with the 'Dev Tools' explained above

3. Once all changes are finalized, download the JSON file using the 'Download JSON' button in the 'Dev Tools' menu

4. Send the JSON file to the IT admin through Slack or email

5. IT admin will confirm when the changes are live on the public Course Mapper
