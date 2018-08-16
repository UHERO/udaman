require 'rails_helper'
require 'redis'

#
# #
# #
# # THIS WHOLE MODULE IS FOR A VESTIGIAL BIT OF CODE, but I'll leave it here and disable
# # for the time being rather than remove right away.
# #
# #
#

module RSpec
  module Sidekiq
    module Matchers
      alias have_enqueued_sidekiq_job have_enqueued_job
    end
  end
end

describe SeriesWorker do
  #redis = Redis.new
  #size = 35
  #redis.del "queue_#{size}"
  xit 'should grab from the queue' do
    series_id = 1
    SeriesWorker.perform_async series_id, size
    expect(SeriesWorker).to have_enqueued_sidekiq_job(series_id, size)
    redis.del "queue_#{size}"
  end

  xit 'should decrease the namespaced queue' do
    series_id = Series.create(name: 'FAKE1@HI.A').id
    redis.set "series_list_#{size}", series_id
    redis.set "current_depth_#{size}", 8
    expect(redis.get "queue_#{size}").to be_a(NilClass)
    SeriesWorker.perform_async series_id, size
    SeriesWorker.drain
    expect(redis.get "queue_#{size}").to eq('-1')
    redis.del "queue_#{size}"
  end
end