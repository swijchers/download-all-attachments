$(function() {

	var

		client = ZAFClient.init(),

		attachments = [],

		path = "ticket.comments",

		$download = $('#download'),
		$list = $('#list'),
		$message = $('#message'),
		$status = $('#status'),

		findAttachments = function() {
			client.get(path).then(function(response) {
				var allComments = response[path];
				attachments = $.map($.makeArray(allComments), function(comment) {
					return [].concat(comment.imageAttachments).concat(comment.nonImageAttachments);
				});
				$('#container').show();
				if (attachments.length === 0) {
					message("No attachments found in this ticket.");
				} else {
					var html = $.map(attachments, function(attachment) {
						return (
							"<li>" +
							"<a href='"+attachment.contentUrl+"'>"+attachment.filename+"</a>" +
							"</li>"
						)
					});
					$list.append(html).toggle();;
					message("<span id='count'>" + attachments.length + " attachment" + (attachments.length == 1 ? "" : "s") + "</span> found in this ticket.");
				}
			});
		},

		downloadAttachments = function() {			
			var zip = new JSZip();
			
			$.each(attachments, function(index, attachment) {
				zip.file(attachment.filename, urlToPromise(attachment.contentUrl), {binary:true});
			});

			zip
			.generateAsync({type:"blob"}, function updateCallback(metadata) {
				status("Making ZIP: " + metadata.percent.toFixed(2) + "%");
			})
			.then(function (blob) {
				client.context().then(function(context) {
					var filename = "Zendesk-";
					filename += context.ticketId;
					filename += "-attachments-";
					filename += new Date().getTime();
					filename += ".zip";
					saveAs(blob, filename);
				})
			})
			.then(function() {
				status("ZIP done!");
				setTimeout(function() {
					hide($status);
					show($message);
					show($download);
				}, 2000);
			});
		},

		message = function(message) {
			display($message, message);
		},
		
		status = function(message) {
			display($status, message);
		},

		display = function($element, message) {
			$element.html(message);
		},

		show = function($element) {
			$element.show(600);
		},

		hide = function($element) {
			$element.hide(600);
		}
	;

	// EVENT HANDLERS //

	client.on('app.registered', function appRegistered(event) {
		findAttachments();
	});

	client.on('ticket.comments.changed', function(event) {
		console.log(event);
	});

	$download.on("click", function() {
		hide($message);
		$download.hide();
		status("Fetching attachments...");
		downloadAttachments();
	});
	
	$message.on("click", function() {
		$list.slideToggle();
	});

});

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



