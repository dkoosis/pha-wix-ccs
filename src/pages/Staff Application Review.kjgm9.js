// The code on this page has been written or altered by Sami from the Wix Wiz team.
// Reach out via support@thewixwiz.com or thewixwiz.com/contact-us.
import {
  getApplications,
  updateReviewDecision,
} from "backend/applicationReview.web.js";
import { currentMember } from "wix-members-frontend";

let lastSelectedFilter = ["All"];
let currentMemberInfo;

$w.onReady(async function () {
  const $tags = $w("#selectionTagsFilters");
  const defaultValue = $tags.options[0].value;
  $tags.value = [defaultValue];
  lastSelectedFilter = [defaultValue];
  const options = {
    fieldsets: ["FULL"],
  };
  currentMemberInfo = await currentMember.getMember(options);
  //console.log(currentMemberInfo);
  await populateRepeaterData();
  $tags.onChange(handleTagFilterChange);

  $w("#repeaterApplications").onItemReady(async ($item, itemData, index) => {
    await handleApplicationRepeater($item, itemData, index);
  });

  $w("#buttonFilter").onClick(async () => {
    await populateRepeaterData();
  });
  $w("#buttonReset").onClick(async () => {
    await resetFields();
  });
});

// 💡 Function to enforce single active tag
async function handleTagFilterChange() {
  const $tags = $w("#selectionTagsFilters");
  const selected = $tags.value;
  if (selected.length === 0) {
    $tags.value = lastSelectedFilter;
  } else {
    const latest = selected[selected.length - 1];
    $tags.value = [latest];
    lastSelectedFilter = [latest];
  }
  //await populateRepeaterData();
}

async function populateRepeaterData() {
  $w("#repeaterApplications").collapse();
  $w("#lottieMainLoader").expand();
  $w("#textMainError").collapse();
  //console.log("Selected Tag", lastSelectedFilter[0]);
  const cmsResults = await getApplications(lastSelectedFilter[0]);
  if (cmsResults.success) {
    console.log("Count", cmsResults.count);
    $w("#textResultCount").text = `${cmsResults.count} results`;
    $w("#repeaterApplications").data = cmsResults.data;
    $w("#repeaterApplications").expand();
  } else {
    // console.log("No Application Found");
    $w(
      "#textMainError"
    ).text = `Failed to load Applications, Please refresh this page`;
    $w("#textMainError").expand();
  }
  $w("#lottieMainLoader").collapse();
}

async function handleApplicationRepeater($item, itemData, index) {
  $item("#textApplicantName").text = `${itemData.title}`;
  $item("#textSubmissionDate").text = `${formatDate(itemData.submissionDate)}`;
  await populateDetailView($item, itemData);
  $item("#textLinKViewDetails").onClick(() => {
    handleItemViewDetail($item, itemData);
  });
  $item("#vectorImageViewDetails").onClick(() => {
    handleItemViewDetail($item, itemData);
  });
  $item("#vectorImageBacktoState1").onClick(() => {
    $item("#multiStateBoxMain").changeState("boxMaster");
  });
  $item("#textBacktoState1").onClick(() => {
    $item("#multiStateBoxMain").changeState("boxMaster");
  });

  $item("#buttonSubmitReview").onClick(async () => {
    await processReviewDecision($item, itemData);
  });
}

async function populateDetailView($item, itemData) {
  $item("#textFirstName").text = `${itemData.firstName || ""}`;
  $item("#textlastName").text = `${itemData.lastNametName || ""}`;
  $item("#textEmail").text = `${itemData.email || ""}`;
  $item("#textPhoneNumber").text = `${itemData.phoneNumber || ""}`;
  $item("#textWebsite").text = `${itemData.website || ""}`;
  $item("#textClayExperience").text = `${
    itemData.hasIndependentExperience ? "Yes" : "No"
  }`;
  $item("#textInstagram").text = `${itemData.instagramHandle || ""}`;
  $item("#textStreet").text = `${itemData.street || ""}`;
  $item("#textCity").text = `${itemData.city || ""}`;
  $item("#textState").text = `${itemData.state || ""}`;
  $item("#textFamiliarWith").text = `${itemData.instagramHandle || ""}`;
  $item("#textSafteyProcedures").text = `${itemData.safetyDescription || ""}`;
  $item("#textStudioPractice").text = `${itemData.practiceDescription || ""}`;
  $item("#textStudioSpaceType").text = `${itemData.studioSpaceType || ""}`;
  $item("#textHowtoSupportCommunity").text = `${
    itemData.communityGoalsSupport || ""
  }`;
  $item("#textInterestsContributions").text = `${
    itemData.communityInterests || ""
  }`;
  $item("#textHowwHeardAbout").text = `${itemData.howHeardAbout || ""}`;
  $item("#textComments").text = `${itemData.textComments || ""}`;
  $item("#textAccessibilityAccNeeded").text = `${
    itemData.textAccessibilityAccNeeded || ""
  }`;
  const tagOptions = Array.isArray(itemData.studioTechniques)
    ? [...new Set(itemData.studioTechniques)].sort().map((item) => ({
        label: item,
        value: item,
      }))
    : [];

  if (tagOptions) {
    $w("#selectionTagsTechniques").options = tagOptions;
  } else {
    $w("#selectionTagsTechniques").options = [];
  }

  if (itemData.reviewStatus === "reviewed") {
    $item("#textBoxDecisionNotes").value = itemData.reviewComment;
    $item("#radioGroupDecision").value = itemData.reviewDecision;
    $item("#textBoxDecisionNotes").disable();
    $item("#buttonSubmitReview").collapse();
    $item("#radioGroupDecision").disable();
  } else {
    $item("#buttonSubmitReview").expand();
  }
}

async function handleItemViewDetail($item, itemData) {
  $item("#multiStateBoxMain").changeState("boxDetail");
}

function formatDate(dateString) {
  const date = new Date(dateString);

  const options = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York", // Change if you want another timezone
  };

  return date.toLocaleString("en-US", options);
}

async function processReviewDecision($item, itemData) {
  $item("#textSuccessMessage").collapse();
  $item("#textErrorMessage").collapse();
  $item("#buttonSubmitReview").disable();
  $item("#lottieEmbedItemLoader").expand();
  const reviewDecision = $item("#radioGroupDecision").value;
  if (!reviewDecision) {
    $item("#textErrorMessage").text = `Review Decision is Required`;
    $item("#textErrorMessage").expand();
    $item("#buttonSubmitReview").enable();
    $item("#lottieEmbedItemLoader").collapse();
    setTimeout(() => {
      $item("#textErrorMessage").collapse();
    }, 3000);
    return;
  }

  const reviewRemarks = $item("#textBoxDecisionNotes").value;
  itemData.reviewStatus = "reviewed";
  itemData.reviewDecision = reviewDecision;
  itemData.reviewComment = reviewRemarks;
  itemData.reviewedBy = currentMemberInfo.loginEmail;
  itemData.reviewedDate = new Date();

  //console.log("Updated itemData:", itemData);

  const resultsUpdate = await updateReviewDecision(itemData);
  if (resultsUpdate.success) {
    $item("#textSuccessMessage").text =
      "Descision Saved Successfully, refreshing data";
    $item("#textSuccessMessage").expand();
    setTimeout(async () => {
      $item("#textSuccessMessage").collapse();
      $item("#multiStateBoxMain").changeState("boxMaster");
      await resetFields();
    }, 5000);
  } else {
    $item(
      "#textErrorMessage"
    ).text = `Unexpected Error Occured, Please try again`;
    $item("#textErrorMessage").expand();
    $item("#buttonSubmitReview").enable();
    setTimeout(() => {
      $item("#textErrorMessage").collapse();
    }, 3000);
  }
  $item("#lottieEmbedItemLoader").collapse();
}

async function resetFields() {
  lastSelectedFilter = ["All"];
  $w("#selectionTagsFilters").value = lastSelectedFilter;
  await populateRepeaterData();
}
