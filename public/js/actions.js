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
        alert("Coming In Module 5");
      } else {
      }

    });
  });

  // =============================== EDIT CLAIM - NEW =======================

  $("#newClaimBtn").click(function(e) {
    console.log("Getting new claim");
    e.preventDefault();

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
  });


  $('#upload').click(function(){
     console.log('upload button clicked!')
     var uploadSuccessMessage = "Coming Soon";
     document.getElementById("uploadProgress").innerHTML = uploadSuccessMessage;
 });


});
