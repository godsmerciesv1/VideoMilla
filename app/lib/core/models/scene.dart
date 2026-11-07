import 'package:flutter/foundation.dart';

import 'json_helpers.dart';

/// A scene groups shots under a heading. Persisted.
@immutable
class Scene {
  const Scene({
    required this.id,
    required this.order,
    this.heading = '',
    this.shotIds = const <String>[],
    this.schemaVersion = currentSchemaVersion,
  });

  factory Scene.fromJson(Map<String, dynamic> json) => Scene(
        id: requireString(json, 'id', model: 'Scene'),
        order: readInt(json['order']),
        heading: readString(json['heading']),
        shotIds: readStringList(json['shotIds']),
        schemaVersion: readInt(json['schemaVersion'], currentSchemaVersion),
      );

  static const int currentSchemaVersion = 1;

  final String id;
  final int order;
  final String heading;
  final List<String> shotIds;
  final int schemaVersion;

  Scene copyWith({int? order, String? heading, List<String>? shotIds}) => Scene(
        id: id,
        order: order ?? this.order,
        heading: heading ?? this.heading,
        shotIds: shotIds ?? this.shotIds,
        schemaVersion: schemaVersion,
      );

  Map<String, dynamic> toJson() => <String, dynamic>{
        'schemaVersion': schemaVersion,
        'id': id,
        'order': order,
        'heading': heading,
        'shotIds': shotIds,
      };

  @override
  bool operator ==(Object other) =>
      other is Scene &&
      other.id == id &&
      other.order == order &&
      other.heading == heading &&
      sameList(other.shotIds, shotIds) &&
      other.schemaVersion == schemaVersion;

  @override
  int get hashCode => Object.hash(id, order, heading, Object.hashAll(shotIds), schemaVersion);
}
