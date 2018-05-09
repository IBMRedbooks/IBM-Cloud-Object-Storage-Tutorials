$(document).ready(function(){

  var filterFloat = function(value) {
    if (/^(\-|\+)?([0-9]+(\.[0-9]+)?|Infinity)$/
      .test(value))
      return Number(value);
  return NaN;
}

  $("#allClaimsBtn").click(function(e){
    let claim_rows = '';
    $.getJSON('/claim', function(data) {
      if (data) {
        $.each(data, function(i, claim) {
          var table_entry = '<tr><td>';

          var images = getClaimImagesMap(claim);
          var sides = ['left', 'right', 'back', 'front'];
          var rendered = false;
          for (var i=0; i<sides.length; i++) {
            var side = sides[i];
            if (!rendered && claim.hasOwnProperty('car_' + side)) {
               var imageId = claim['car_' + side];
               console.log('Rendering thumbnail for ' + side + ' image ' + imageId);
               var image = images[imageId];
               var imageTag = createImageTag(image, claim.claimId, side);
               table_entry += imageTag;
               rendered = true;
            }
          }
          table_entry += '</td>';
          table_entry += '<td>' + claim.claimId + '</td><td>' + claim.created + '</td>';
          table_entry += '<td><a href="#" onclick="navEditClaim(\'' + claim.claimId + '\')">Edit Claim</a></td></tr>';
          claim_rows += table_entry;
        });
        document.getElementById('allClaimsTableBody').innerHTML=claim_rows;

        uiDisplayAllClaims();
      } else {
        alert('Could not load your claims!');
      }

    });
  });

  // =============================== EDIT CLAIM - EXISTING ==================


$('#editClaimButton').click(function (e) {
  // load the edit claim page with existing claim information
  var claimId =  document.getElementById("claimSummaryId").innerHTML;

  $.ajax({
    type: 'GET',
    url: '/user',
    dataType: 'json',
    contentType: 'application/json',
    cache: false,
    timeout: 1000,
    success: function(user) {
      console.log('Retrieved user ' + user.name + ' (' + user.userId + ')');
      document.getElementById('policyUserName').innerHTML = user.name;

      // We have claimId now, so use that to render the claim page
      uiDisplayEditClaim(claimId);

      // Then continue loading the claim details
      retrieveClaimDetails(claimId);

      }
    });
});


  // =============================== EDIT CLAIM - NEW =======================

  $("#newClaimBtn").click(function(e) {
    console.log("Getting new claim");
    e.preventDefault();

    // load the user to display some nice policy information
    $.ajax({
      type: 'GET',
      url: '/user',
      dataType: 'json',
      contentType: 'application/json',
      cache: false,
      timeout: 1000,
      success: function(user) {
        console.log('Retrieved user ' + user.name + ' (' + user.userId + ')');
        document.getElementById('policyUserName').innerHTML = user.name;

        // create a claim to start working on
        $.post(
          "/claim",
          {},
          function(data, textStatus, jqXHR) {
            console.log (textStatus);
            if (textStatus == "success") {
              var claimFQDN = jqXHR.getResponseHeader("Location");
              var claimId = claimFQDN.split("/")[2];
              var fullClaimLocation = jqXHR.getResponseHeader("Location");
              console.log('found claim location', fullClaimLocation);

              // Now render the page
              uiDisplayEditClaim(claimId);
            } else {
              alert("Failed to create claim!");
            }
        });
      },
      error: function(jqXHR, exception) {
        // TODO: make this do something better
        alert('Could not get user information! ' + exception);
        //var policy_drop_down = "<option>Could not load policies</option>";
        //document.getElementById("all_policies").innerHTML=policy_drop_down;
        //document.getElementById("all_policies").disabled = true;
      }
    });
  });


  $('#upload').click(function(){
     console.log('upload button clicked!')
     var fd = new FormData();
     fd.append( 'userfile', $('#userfile')[0].files[0]);
     var claimId =  document.getElementById("claimSummaryId").innerHTML;
     console.log(claimId);
     var postImageURL = "/claim/" + claimId + "/image";
     var uploadInProgessMessage = "Upload In Progress...";
     document.getElementById("uploadProgress").innerHTML = uploadInProgessMessage;
     $.ajax({
       url: postImageURL,
       data: fd,
       processData: false,
       contentType: false,
       type: 'POST',
       success: function(data){
         console.log('upload success!')
         var uploadSuccessMessage = "Upload Succeeded";
         document.getElementById("uploadProgress").innerHTML = uploadSuccessMessage;
         $('#data').empty();
         $('#data').append(data);
         retrieveClaimDetails(claimId);
       },
       error: function(error) {
         var uploadFailedMessage;
         if(error) {
           uploadFailedMessage = error.statusText + " - " + error.responseText
         } else {
           uploadFailedMessage = "Upload Failed";
         }
         document.getElementById("uploadProgress").innerHTML = uploadFailedMessage;
       }
     });
 });

 function initMap(gpsLat, gpsLatRef, gpsLong, gpsLongRef) {
   console.log(gpsLat);
   console.log(gpsLatRef);
   console.log(gpsLong);
   console.log(gpsLongRef);
   var latDegrees = gpsLat.split(',')[0].split('/')[0].trim();
   var latMins = gpsLat.split(',')[1].split('/')[0].trim();
   var longDegrees = gpsLong.split(',')[0].split('/')[0].trim();
   var longMins = gpsLong.split(',')[1].split('/')[0].trim();
   var latString;
   var longString;
   if (gpsLatRef === "N") {
     latString = latDegrees + "." + latMins;
     console.log(latString);
   }
   if (gpsLatRef === "S") {
     latString = "-" + latDegrees + "." + latMins;
     console.log(latString)
   }
   var latitude = filterFloat(latString);
   console.log(latitude)
   if (gpsLongRef === "E") {
     longString = longDegrees + "." + longMins;
     console.log(longString);
   }
   if (gpsLongRef === "W") {
     longString = "-" + longDegrees + "." + longMins;
     console.log(longString);
   }
   var longitude = filterFloat(longString);
   console.log(longitude);
   var centerPosition = {
     lat: latitude,
     lng: longitude
   }
   console.log(centerPosition);
   var map = new google.maps.Map(document.getElementById('map'), {
     zoom: 10,
     center: centerPosition
   });
   var marker = new google.maps.Marker({
     position: centerPosition,
     map: map
   });
 }

 function renderImageDetails(imageMetadata, weatherDetails, vrDetails) {
   var table_content = "<tr>"
   table_content += "<td>Car Color</td>";
   if (vrDetails && vrDetails.carColor) {
      table_content += "<td>" + vrDetails.carColor[0].class + "</td>";
   } else {
     table_content += "<td>Color not available.</td>";
   }
   table_content += "</tr>"
   table_content += "<tr>";
   table_content += "<td>Damage Type</td>";
   table_content += "<td>Bump on Fender</td>";
   table_content += "</tr>"
   table_content += "<tr>";
   table_content += "<td>Weather Conditions on Incident Date</td>";
   if (weatherDetails) {
      table_content += "<td>" + weatherDetails.wx_phrase + " in " + weatherDetails.obs_name + "</td>";
   } else {
     table_content += "<td>Weather not available.</td>";
   }
   table_content += "</tr>"
   table_content += "<tr>";
   table_content += "<td>Approxiate Date and Time of Incident</td>"
   if (imageMetadata && imageMetadata.dateTime) {
      table_content += "<td>"+ imageMetadata.dateTime + "</td>";
   } else {
     table_content += "<td>Time not available.</td>";
   }
   table_content += "</tr>";
   table_content += "<tr>";
   table_content += "<td>Approximate Location of Incident</td>"
   if (imageMetadata && imageMetadata.gpsLatitude && imageMetadata.gpsLongitude) {
     table_content += "<td><div id=\"map\"></div><td>"
   } else {
     table_content += "<td>Location not available.</td>";
   }
   table_content += "<td></td>"
   document.getElementById("imageDetailsBody").innerHTML=table_content;
   initMap(imageMetadata.gpsLatitude, imageMetadata.gpsLatitudeRef, imageMetadata.gpsLongitude, imageMetadata.gpsLongitudeRef);
   document.getElementById("confirmClaimLegend").style.display="block";
   document.getElementById("confirmClaimBtn").style.display="block";
 }



 function getClaimImagesMap(claim) {
   var images = {};
   for (var i=0; i<claim.images.length; i++) {
     var imageIds = Object.keys(claim.images[i]);
     for (var j=0; j<imageIds.length; j++) {
       var imageId = imageIds[j];
       images[imageId] = claim.images[i][imageId];
     }
   }
   return images;
 }

 function createImageTag(image, claimId, side) {
   var normalizedImageURL = "/claim/" + claimId + "/image";
   var normalizedImageKey = image.normalized;
   var base64URL = encodeURI(normalizedImageKey);
   var relativeImageURL = normalizedImageURL + "?key=" + base64URL;
   var imageTag = "<img src=" + relativeImageURL + " style=\"width:200px;\">";
   return imageTag;
 }

 function retrieveClaimDetails(claimId) {
   console.log("Retriving claim: " + claimId);
   var getClaimURL = "/claim/" + claimId;
   $.ajax ({
     url: getClaimURL,
     type: 'GET',
     success: function(data) {
       console.log(data);
       var claimJSON = data;
       console.log (claimJSON);

       // Move images into a map for making lookup easier
       var images = getClaimImagesMap(data);

       var sides = ['left', 'right', 'back', 'front'];

       // reset images to avoid leakage from previous views
       for (var i=0; i<sides.length; i++) {
         var side = sides[i];
         document.getElementById("car_" + side).innerHTML = "";
       }

       // find each image and display it, updating claim details to use the last views
       for (var i=0; i<sides.length; i++) {
         var side = sides[i];
         if (data.hasOwnProperty('car_' + side)) {
            var imageId = data['car_' + side];
            console.log('Rendering details for ' + side + ' image ' + imageId);
            var image = images[imageId];
            var imageTag = createImageTag(image, claimId, side);
            imageTag += "<div class=\"caption\">" +
              "<p> " + side + " of your car </p>" +
              "</div>";
            document.getElementById("car_" + side).innerHTML = imageTag;
            renderImageDetails(image.imageMetadata, image.weatherData,
              image.vrClassification);
         }
       }
     },
     error: function() {
       alert("Retrieve of claim failed")
     }
   });
 }



 $('#confirmClaimBtn').click(function() {
   $('#allClaimsBtn').trigger('click');
 });

});
