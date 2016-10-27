require 'spec_helper'
require 'redis'

describe SeriesWorker do
  redis = Redis.new
  series_id = 'FAKE@HI.A'.tsn.id
  size = 35
  it 'should grab from the queue' do
    SeriesWorker.perform_async series_id, size
    expect(SeriesWorker).to have_enqueued_job(series_id, size)
  end

  it 'should decrease the namespaced queue' do
    expect(redis.get "queue_#{size}").to eq('0')
    SeriesWorker.perform_async series_id, size
    SeriesWorker.drain
    expect(redis.get "queue_#{size}").to eq('-1')
  end
end