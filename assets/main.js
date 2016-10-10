$(function() {

	'use strict';

	var

		client = ZAFClient.init(),

		attachments = [],

		path = "ticket.comments",

		$download = $('#download'),
		$list = $('#list'),
		$message = $('#message'),
		$status = $('#status'),
		$progress = $('#progress'),

		findAttachments = function() {
			return client.get(path).then(function(response) {
				var allComments = response[path];
				attachments = $.map($.makeArray(allComments), function(comment) {
					return [].concat(comment.imageAttachments).concat(comment.nonImageAttachments);
				});
				return new Promise(function(resolve, reject) {
					if (!$.isArray(attachments) || attachments.length === 0) {
						reject("No attachments found in this ticket.");
					} else {
						resolve();
					}
				});
			});
		},

		displayAttachments = function() {
			var html = $.map(attachments, function(attachment) {
				return (
					"<li>" +
					"<a href='"+attachment.contentUrl+"' target='_blank'>"+attachment.filename+"</a>" +
					"</li>"
				)
			});
			$list.
				append(html).
				toggle()
			;
			message("<span id='count'>" + attachments.length + " attachment" + (attachments.length == 1 ? "" : "s") + "</span> found in this ticket.");
		},

		makeZip = function() {
			var zip = new JSZip();
			$.each(attachments, function(index, attachment) {
				zip.file(
					attachment.filename,
					urlToPromise(attachment.contentUrl),
					{
						binary:true
					}
				);
			});
			return zip;
		},

		downloadAttachments = function() {
			var first = true;
			return makeZip()
			.generateAsync({type:"blob"}, function updateCallback(metadata) {

				if (first) {
					$progress.show();
					first = false;
				}

				var percent = metadata.percent;
				$progress.percent = percent;
				status("Making ZIP: " + percent.toFixed(2) + "%");
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

	/**
	* Set the width of the colored part of the progress bar.
	*/
	Object.defineProperty($progress, "percent", {
		set: function(percent) {
			this
			.children(":first")
			.attr('aria-valuenow', percent)
			.width(percent+"%");
		}
	});

	// EVENT HANDLERS //

	client.on('app.registered', function appRegistered(event) {
		$progress.hide();
		findAttachments()
		.then(function() {
			attachments.sort(function(a,b) {
				return a.filename > b.filename ? 1 : a.filename < b.filename ? -1 : 0;
			});
			displayAttachments();
			$download.show();
		})
		.catch(function(err) {
			message(err);
			$download.hide();
		})
		.then(function() {
			$('#container').show();
		});
	});

	client.on('ticket.comments.changed', function(event) {
		console.log(event);
	});

	$download.on("click", function() {
		hide($message);
		$download.hide();
		show($status);
		status("Fetching attachments...");
		downloadAttachments().
		then(function() {
			status("ZIP done!");
			setTimeout(function() {
				hide($status);
				hide($progress);
				$progress.percent = 0;
				show($message);
				show($download);
			}, 2000);
		});
	});
	
	$message.on("click", function() {
		$list.slideToggle();
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

});

