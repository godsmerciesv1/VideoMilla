import 'package:flutter/foundation.dart';

import 'json_helpers.dart';

/// Where a pack is sold.
enum Channel { play, polar }

/// One credit pack. The price is never stored here: it comes from the store
/// (Android) or the checkout (web), so it is always the local, current price.
@immutable
class CreditPack {
  const CreditPack({
    required this.productId,
    required this.credits,
    required this.channel,
    this.tierLabel = '',
  });

  /// Reads one entry of `packs_play` / `packs_polar` from the Worker config.
  factory CreditPack.fromJson(Map<String, dynamic> json, {required Channel channel}) => CreditPack(
        productId: requireString(json, 'product_id', model: 'CreditPack'),
        credits: readInt(json['credits']),
        channel: channel,
        tierLabel: readString(json['tier_label']),
      );

  /// Play product ID, or the Polar product ID.
  final String productId;
  final int credits;
  final Channel channel;

  /// Optional name from config, for example a tier name.
  final String tierLabel;

  CreditPack copyWith({String? productId, int? credits, Channel? channel, String? tierLabel}) => CreditPack(
        productId: productId ?? this.productId,
        credits: credits ?? this.credits,
        channel: channel ?? this.channel,
        tierLabel: tierLabel ?? this.tierLabel,
      );

  Map<String, dynamic> toJson() => <String, dynamic>{
        'product_id': productId,
        'credits': credits,
        'tier_label': tierLabel,
      };

  @override
  bool operator ==(Object other) =>
      other is CreditPack &&
      other.productId == productId &&
      other.credits == credits &&
      other.channel == channel &&
      other.tierLabel == tierLabel;

  @override
  int get hashCode => Object.hash(productId, credits, channel, tierLabel);
}
