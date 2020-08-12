//For django-bootstrap-modal-forms
$(document).ready(function() {

    $("#subscribe-button").modalForm({
        //formURL: "{% url 'subscribe' %}"
        formURL: "/newsletter/subscribe/"
    });
});
