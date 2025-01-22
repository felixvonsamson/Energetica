from flask import Response, jsonify, request, send_file
from flask_login import current_user


def register_app_services(app):
    @app.route("/subscribe", methods=["GET", "POST"])
    def subscribe() -> Response:
        """POST: Create a new subscription. GET: Return VAPID public key."""
        if request.method == "GET":
            return jsonify({"public_key": app.config["VAPID_PUBLIC_KEY"]})
        subscription = request.json
        if "endpoint" not in subscription:
            return jsonify({"response": "Invalid subscription"})
        current_user.notification_subscriptions.append(subscription)
        return jsonify({"response": "Subscription successful"})

    @app.route("/unsubscribe", methods=["POST"])
    def unsubscribe() -> Response:
        """POST: remove a subscription."""
        subscription = request.json
        if subscription in current_user.notification_subscriptions:
            current_user.notification_subscriptions.remove(subscription)
        return jsonify({"response": "Unsubscription successful"})

    @app.route("/apple-app-site-association")
    def apple_app_site_association() -> Response:
        """
        Return the apple-app-site-association JSON data.

        Needed for supporting associated domains needed for shared webcredentials.
        """
        return send_file("static/apple-app-site-association", as_attachment=True)
