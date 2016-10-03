$(function() {

	var

		client = ZAFClient.init(),

		attachments = [],

		path = "ticket.comments",

		findAttachments = function() {
			client.get(path).then(function(response) {
				var allComments = response[path];
				attachments = $.map($.makeArray(allComments), function(comment) {
					return [].concat(comment.imageAttachments).concat(comment.nonImageAttachments);
				});
				if (attachments.length === 0) {
					hide("#download");
					message("No attachments found in this ticket.");
				} else {
					var $list = $("#list");
					var html = $.map(attachments, function(attachment) {
						return (
							"<li>" +
							"<a href='"+attachment.contentUrl+"'>"+attachment.filename+"</a>" +
							"</li>"
						)
					});
					$list.append(html);
					show("#download");
					message("<span id='count'>" + attachments.length + " attachment" + (attachments.length == 1 ? "" : "s") + "</span> found in this ticket.");
				}
			});
		},

		downloadAttachments = function() {
			message("Fetching files...");
			
			var zip = new JSZip();
			$.each(attachments, function(index, attachment) {
				zip.file(attachment.filename, urlToPromise(attachment.contentUrl), {binary:true});
			});
			zip
			.generateAsync({type:"blob"}, function updateCallback(metadata) {
				message("Making ZIP: " + metadata.percent.toFixed(2) + "% complete.");
			})
			.then(function (content) {
				var now = new Date();
				var filename = "attachments-";
					filename += now.getFullYear() + "-" + (now.getMonth()+1) + "-" + now.getDate() + "-" + now.getMilliseconds();
					filename += ".zip";
				saveAs(content, filename);
			})
			.then(function() {
				message("ZIP downloading.");
			});
		}
	;

	client.on('app.registered', function(event) {
		message("Finding attachments...");
		findAttachments();
	});

	client.on('ticket.comments.changed', function(event) {
		console.log(event);
	});

	$("#download").on("click", function() {
		downloadAttachments();
	});
	
	$("#message").on("click", function() {
		$("#list").slideToggle();
	});

});

function message(message) {
	$("#message").html(message);
}

function show(selector) {
	$(selector).removeClass("hidden").addClass("visible");
}

function hide(selector) {
	$(selector).removeClass("visible").addClass("hidden");
}


/**
 * Fetch the content and return the associated promise.
 * @param {String} url the url of the content to fetch.
 * @return {Promise} the promise containing the data.
 */
function urlToPromise(url) {
	return new Promise(function(resolve, reject) {
		JSZipUtils.getBinaryContent(url, function (err, data) {
			if(err) {
				reject(err);
			} else {
				resolve(data);
			}
		});
	});
}



